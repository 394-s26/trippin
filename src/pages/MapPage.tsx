import { useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import './Home.css';

const MapPage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="home-wrapper">
      <div className="home-container">
        <AppHeader />
        <main className="home-main">
          <div className="home-content">
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <p className="text-lg font-medium">Map</p>
              <p className="text-sm">Coming soon for trip {id}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MapPage;
