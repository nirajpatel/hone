import honeLogo from '../assets/hone-logo.svg';

export function AppNavBrand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <img src={honeLogo} alt="" className="app-nav-logo" style={{ height: '22px', width: 'auto', display: 'block' }} />
      <span className="hidden md:inline text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: '18px', lineHeight: 1, color: '#111827' }}>Hone</span>
    </div>
  );
}
