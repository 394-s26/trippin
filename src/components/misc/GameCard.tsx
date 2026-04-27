import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppUser } from '../../types/auth';
import {
  TripGame,
  acceptGameInvite,
  declineGameInvite,
  endGame,
  inviteToGame,
  playGameMove,
  resetGameBoard,
} from '../../services/firestoreMiscService';
import { XIcon } from '../../services/svgIcons';
import UserAvatar from '../UserAvatar';
import './GameCard.css';

interface GameCardProps {
  tripId: string;
  currentUid: string | null;
  game: TripGame | null;
  tripUsers: AppUser[];
}

const nameOf = (users: AppUser[], uid: string): string => {
  const u = users.find((x) => x.uid === uid);
  if (!u) return 'Someone';
  return `${u.firstName} ${u.lastName}`.trim() || u.username || 'Someone';
};

const CONFETTI_DURATION_MS = 3000;
const CONFETTI_PIECE_COUNT = 36;
const CONFETTI_COLORS = ['#2D5A27', '#178F96', '#98FB98', '#fbbf24', '#ec4899', '#3b82f6'];

const Confetti = () => {
  // Memoize-ish via initial render — we don't need updates.
  const pieces = Array.from({ length: CONFETTI_PIECE_COUNT }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size = 6 + Math.random() * 6;
    const duration = 1.5 + Math.random() * 1.4;
    const drift = (Math.random() - 0.5) * 80; // px horizontal drift
    return { i, left, delay, color, size, duration, drift };
  });
  return (
    <div className="misc-game-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.i}
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
};

const GameCard = ({ tripId, currentUid, game, tripUsers }: GameCardProps) => {
  const [popupOpen, setPopupOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const winFiredRef = useRef<number | null>(null);

  const isPlayerX = currentUid && game?.playerX === currentUid;
  const isPlayerO = currentUid && game?.playerO === currentUid;
  const isParticipant = Boolean(isPlayerX || isPlayerO);
  const mySymbol: 'X' | 'O' | null = isPlayerX ? 'X' : isPlayerO ? 'O' : null;

  const isMyPendingInvite = game?.status === 'pending' && isPlayerO;
  const gameActive = game?.status === 'active';
  const gameOverState = game && (game.status === 'completed' || game.status === 'draw' || game.status === 'declined');
  const noGame = !game || Boolean(gameOverState);

  const isMyWin = game?.status === 'completed' && game.winner === currentUid;
  const isMyLoss = game?.status === 'completed' && game.winner != null && game.winner !== currentUid && isParticipant;
  const isDraw = game?.status === 'draw';

  const opponents = tripUsers.filter((u) => u.uid !== currentUid);

  // Clear error when game state changes significantly.
  useEffect(() => {
    setError(null);
  }, [game?.status]);

  // Auto-close popup if:
  //   (a) the game doc disappeared,
  //   (b) the invitee declined while we still had the popup open as challenger,
  //   (c) someone clicked End-game (status becomes 'completed' with no winner).
  // A natural completion (status='completed' with a winner) or a draw keeps
  // the popup open so players can see the result / confetti.
  useEffect(() => {
    if (!popupOpen) return;
    if (!game) {
      setPopupOpen(false);
      return;
    }
    if (game.status === 'declined') setPopupOpen(false);
    if (game.status === 'completed' && game.winner === null) setPopupOpen(false);
  }, [popupOpen, game]);

  // Fire confetti exactly once per win — keyed by createdAt so a fresh game
  // re-arms the trigger.
  useEffect(() => {
    if (!isMyWin || !game) return;
    const key = game.createdAt.toMillis();
    if (winFiredRef.current === key) return;
    winFiredRef.current = key;
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), CONFETTI_DURATION_MS);
    return () => clearTimeout(t);
  }, [isMyWin, game]);

  const handleStartGameClick = () => {
    setError(null);
    setPicker(true);
  };

  const handleViewClick = () => {
    setError(null);
    setPopupOpen(true);
  };

  const handleInvite = async (opponentUid: string) => {
    if (!currentUid) return;
    setError(null);
    try {
      await inviteToGame(tripId, currentUid, opponentUid);
      setPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite.');
    }
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUid) return;
    setError(null);
    try {
      await acceptGameInvite(tripId, currentUid);
      setPopupOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept.');
    }
  };

  const handleDecline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUid) return;
    setError(null);
    try {
      await declineGameInvite(tripId, currentUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline.');
    }
  };

  const handleCellClick = async (index: number) => {
    if (!currentUid || !game || !gameActive || !mySymbol) return;
    if (game.turn !== mySymbol) return;
    if (game.board[index] !== null) return;
    setError(null);
    try {
      await playGameMove(tripId, currentUid, index);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed.');
    }
  };

  const handleReset = async () => {
    if (!currentUid) return;
    setError(null);
    try {
      await resetGameBoard(tripId, currentUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    }
  };

  const handleEnd = async () => {
    if (!currentUid) return;
    setError(null);
    try {
      await endGame(tripId, currentUid);
      setPopupOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'End failed.');
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // Card body — every state renders centered text and a cylinder action
  // button, except the my-pending-invite case which uses two pill buttons.
  // ──────────────────────────────────────────────────────────────────────

  const renderCardBody = () => {
    // No game / past game → start cylinder.
    if (!game || gameOverState) {
      let primary: string;
      let sub: string | null = 'Tap to challenge a member';
      if (game?.status === 'completed' && game.winner) {
        primary = `${nameOf(tripUsers, game.winner)} won`;
      } else if (game?.status === 'draw') {
        primary = 'Draw';
      } else if (game?.status === 'declined') {
        primary = 'Invite declined';
      } else {
        primary = 'No game in progress';
      }
      return (
        <>
          <span className="misc-game-status">{primary}</span>
          {sub && <span className="misc-game-sub">{sub}</span>}
          <button
            type="button"
            className="misc-game-cylinder-btn"
            onClick={handleStartGameClick}
            disabled={!currentUid}
          >
            Start a new game
          </button>
        </>
      );
    }

    if (game.status === 'pending') {
      if (isMyPendingInvite) {
        return (
          <>
            <span className="misc-game-status">
              {nameOf(tripUsers, game.playerX)} challenges you!
            </span>
            <div className="misc-game-invite-actions">
              <button
                type="button"
                className="misc-game-cylinder-btn"
                onClick={handleAccept}
              >
                Accept
              </button>
              <button
                type="button"
                className="misc-game-cylinder-btn misc-game-cylinder-btn--ghost"
                onClick={handleDecline}
              >
                Decline
              </button>
            </div>
          </>
        );
      }
      if (isPlayerX) {
        return (
          <>
            <span className="misc-game-status">
              Waiting for {nameOf(tripUsers, game.playerO)}…
            </span>
            <button
              type="button"
              className="misc-game-cylinder-btn misc-game-cylinder-btn--ghost"
              onClick={handleViewClick}
            >
              View / Cancel
            </button>
          </>
        );
      }
      return (
        <>
          <span className="misc-game-status">
            {nameOf(tripUsers, game.playerX)} challenged {nameOf(tripUsers, game.playerO)}
          </span>
          <span className="misc-game-sub">Pending…</span>
        </>
      );
    }

    // active
    return (
      <>
        <span className="misc-game-status">
          {nameOf(tripUsers, game.playerX)} vs {nameOf(tripUsers, game.playerO)}
        </span>
        <span className="misc-game-sub">
          {isParticipant
            ? game.turn === mySymbol ? 'Your turn' : 'Waiting for opponent'
            : 'In progress'}
        </span>
        <button
          type="button"
          className="misc-game-cylinder-btn"
          onClick={handleViewClick}
        >
          {isParticipant ? 'Open game' : 'Watch'}
        </button>
      </>
    );
  };

  // ──────────────────────────────────────────────────────────────────────
  // Popup helpers
  // ──────────────────────────────────────────────────────────────────────

  const winnerName = game?.winner ? nameOf(tripUsers, game.winner) : null;
  const labelFor = (uid: string) => (uid === currentUid ? 'You' : nameOf(tripUsers, uid));

  // Decide the board overlay state.
  // - Active + opponent's turn (or spectator): 'wait'
  // - Completed + I won: 'won' (also fires confetti via separate effect)
  // - Completed + I lost: 'lost'
  // - Completed/draw — neutral participant or spectator: 'wait'
  const boardOverlay: 'wait' | 'won' | 'lost' | null = (() => {
    if (!game) return null;
    if (gameActive) {
      if (!isParticipant) return 'wait';
      if (game.turn !== mySymbol) return 'wait';
      return null;
    }
    if (game.status === 'completed') {
      if (isMyWin) return 'won';
      if (isMyLoss) return 'lost';
      return 'wait';
    }
    if (isDraw) return 'wait';
    return null;
  })();

  return (
    <>
      <div className="misc-card misc-card--game">
        <div className="misc-card-header misc-card-header--centered">
          <span className="misc-card-title">GAME</span>
        </div>
        <div className="misc-game-body">{renderCardBody()}</div>
        {error && <span className="misc-game-error">{error}</span>}
      </div>

      {/* Opponent picker */}
      {picker && createPortal(
        <div className="overlay-bottom">
          <div className="overlay-scrim" onClick={() => setPicker(false)} />
          <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-5 pb-8 flex flex-col gap-3 animate-slide-up misc-modal">
            <div className="misc-modal-header">
              <h2 className="misc-modal-title">Challenge a member</h2>
              <button
                type="button"
                className="misc-modal-close"
                onClick={() => setPicker(false)}
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>
            {opponents.length === 0 ? (
              <div className="misc-photos-empty">No other members on this trip yet.</div>
            ) : (
              <ul className="misc-game-opponent-list">
                {opponents.map((u) => (
                  <li key={u.uid}>
                    <button
                      type="button"
                      className="misc-game-opponent-btn"
                      onClick={() => handleInvite(u.uid)}
                    >
                      <UserAvatar user={u} size="sm" />
                      <span>{`${u.firstName} ${u.lastName}`.trim() || u.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <div className="misc-photos-error">{error}</div>}
          </div>
        </div>,
        document.body,
      )}

      {/* Active game popup */}
      {popupOpen && game && createPortal(
        <div className="overlay-bottom">
          <div className="overlay-scrim" onClick={() => setPopupOpen(false)} />
          <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-5 pb-8 flex flex-col gap-4 animate-slide-up misc-modal misc-game-popup">
            <div className="misc-modal-header">
              <h2 className="misc-modal-title">Tic-Tac-Toe</h2>
              <button
                type="button"
                className="misc-modal-close"
                onClick={() => setPopupOpen(false)}
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="misc-game-players">
              <div className={`misc-game-player${game.turn === 'X' && game.status === 'active' ? ' misc-game-player--active' : ''}`}>
                <span className="misc-game-player-symbol">X</span>
                <span className="misc-game-player-name">{labelFor(game.playerX)}</span>
              </div>
              <div className="misc-game-vs">vs</div>
              <div className={`misc-game-player${game.turn === 'O' && game.status === 'active' ? ' misc-game-player--active' : ''}`}>
                <span className="misc-game-player-symbol">O</span>
                <span className="misc-game-player-name">{labelFor(game.playerO)}</span>
              </div>
            </div>

            <div className="misc-game-board-wrapper">
              <div className="misc-game-board">
                {game.board.map((cell, i) => {
                  const disabled =
                    !gameActive ||
                    !isParticipant ||
                    game.turn !== mySymbol ||
                    cell !== null;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`misc-game-cell misc-game-cell--${cell ?? 'empty'}`}
                      onClick={() => handleCellClick(i)}
                      disabled={disabled}
                      aria-label={`Cell ${i + 1}${cell ? ` — ${cell}` : ''}`}
                    >
                      {cell}
                    </button>
                  );
                })}
              </div>
              {boardOverlay && (
                <div
                  className={`misc-game-board-overlay misc-game-board-overlay--${boardOverlay}`}
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="misc-game-state-line">
              {game.status === 'active' && (
                <span>
                  {isParticipant
                    ? game.turn === mySymbol ? 'Your turn' : "Opponent's turn"
                    : `Turn: ${game.turn}`}
                </span>
              )}
              {game.status === 'completed' && winnerName && (
                <span className="misc-game-result">
                  {isMyWin ? 'You win!' : isMyLoss ? `${winnerName} wins.` : `${winnerName} wins!`}
                </span>
              )}
              {game.status === 'draw' && <span className="misc-game-result">It's a draw.</span>}
              {game.status === 'pending' && (
                <span>Waiting for {nameOf(tripUsers, game.playerO)} to accept…</span>
              )}
            </div>

            {error && <div className="misc-photos-error">{error}</div>}

            {isParticipant && (game.status === 'active' || game.status === 'completed' || game.status === 'draw') && (
              <div className="misc-game-actions">
                <button type="button" className="misc-game-reset-btn" onClick={handleReset}>
                  Reset board
                </button>
                <button type="button" className="misc-game-end-btn" onClick={handleEnd}>
                  End game
                </button>
              </div>
            )}
            {isParticipant && game.status === 'pending' && (
              <div className="misc-game-actions">
                <button
                  type="button"
                  className="misc-game-end-btn"
                  onClick={(e) => handleDecline(e)}
                >
                  {isPlayerX ? 'Cancel invite' : 'Decline'}
                </button>
              </div>
            )}

            {showConfetti && <Confetti />}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default GameCard;
