import { useParams } from 'react-router-dom';
import './Home.css';

const MiscPage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="home-wrapper">
      <div className="home-container">
        <main className="home-main">
          <div className="home-content">
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <p className="text-lg font-medium">Misc</p>
              <p className="text-sm">Coming soon for trip {id}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MiscPage;
