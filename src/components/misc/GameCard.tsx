import { useEffect, useState } from 'react';
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

const GameCard = ({ tripId, currentUid, game, tripUsers }: GameCardProps) => {
  const [popupOpen, setPopupOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlayerX = currentUid && game?.playerX === currentUid;
  const isPlayerO = currentUid && game?.playerO === currentUid;
  const isParticipant = Boolean(isPlayerX || isPlayerO);
  const mySymbol: 'X' | 'O' | null = isPlayerX ? 'X' : isPlayerO ? 'O' : null;

  const isMyPendingInvite = game?.status === 'pending' && isPlayerO;
  const gameActive = game?.status === 'active';
  const gameOverState = game && (game.status === 'completed' || game.status === 'draw' || game.status === 'declined');
  const noGame = !game || Boolean(gameOverState);

  const opponents = tripUsers.filter((u) => u.uid !== currentUid);

  // Clear error when game state changes significantly.
  useEffect(() => {
    setError(null);
  }, [game?.status]);

  // Close popup if game disappears or becomes "over" while we're watching; the
  // end state is still shown on the card.
  useEffect(() => {
    if (!popupOpen) return;
    if (!game) setPopupOpen(false);
  }, [popupOpen, game]);

  const handleOpen = () => {
    setError(null);
    if (noGame) {
      setPicker(true);
      return;
    }
    if (isMyPendingInvite) {
      // Pending invites are accepted/declined from the card directly — no auto-open.
      return;
    }
    // Active game or spectator view → open popup.
    if (isParticipant || game?.status === 'active' || game?.status === 'completed' || game?.status === 'draw') {
      setPopupOpen(true);
    }
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

  // ────────────────────────────────────────
  // Card summary
  // ────────────────────────────────────────
  const renderSummary = () => {
    if (!game || gameOverState) {
      if (game?.status === 'completed' && game.winner) {
        return (
          <>
            <span className="misc-game-status">
              {nameOf(tripUsers, game.winner)} won
            </span>
            <span className="misc-game-sub">Tap to start a new game</span>
          </>
        );
      }
      if (game?.status === 'draw') {
        return (
          <>
            <span className="misc-game-status">Draw</span>
            <span className="misc-game-sub">Tap to start a new game</span>
          </>
        );
      }
      if (game?.status === 'declined') {
        return (
          <>
            <span className="misc-game-status">Invite declined</span>
            <span className="misc-game-sub">Tap to challenge someone</span>
          </>
        );
      }
      return (
        <>
          <span className="misc-game-status">No game in progress</span>
          <span className="misc-game-sub">Tap to challenge a member</span>
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
                className="misc-game-invite-accept"
                onClick={handleAccept}
              >
                Accept
              </button>
              <button
                type="button"
                className="misc-game-invite-decline"
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
            <span className="misc-game-sub">Tap to cancel or watch</span>
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
            ? game.turn === mySymbol ? 'Your turn — tap to play' : 'Waiting for opponent'
            : 'In progress — tap to watch'}
        </span>
      </>
    );
  };

  const winnerName = game?.winner ? nameOf(tripUsers, game.winner) : null;

  return (
    <>
      <button
        type="button"
        className="misc-card misc-card--game"
        onClick={handleOpen}
        aria-label="Open game"
      >
        <div className="misc-card-header">
          <span className="misc-card-title">GAME</span>
        </div>
        <div className="misc-game-summary">{renderSummary()}</div>
        {error && <span className="misc-game-error">{error}</span>}
      </button>

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
          <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-5 pb-8 flex flex-col gap-4 animate-slide-up misc-modal">
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
                <span className="misc-game-player-name">{nameOf(tripUsers, game.playerX)}</span>
              </div>
              <div className="misc-game-vs">vs</div>
              <div className={`misc-game-player${game.turn === 'O' && game.status === 'active' ? ' misc-game-player--active' : ''}`}>
                <span className="misc-game-player-symbol">O</span>
                <span className="misc-game-player-name">{nameOf(tripUsers, game.playerO)}</span>
              </div>
            </div>

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

            <div className="misc-game-state-line">
              {game.status === 'active' && (
                <span>
                  {isParticipant
                    ? game.turn === mySymbol ? "Your turn" : "Opponent's turn"
                    : `Turn: ${game.turn}`}
                </span>
              )}
              {game.status === 'completed' && winnerName && (
                <span className="misc-game-result">{winnerName} wins!</span>
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
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default GameCard;
