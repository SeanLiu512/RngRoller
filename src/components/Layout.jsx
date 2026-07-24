import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}