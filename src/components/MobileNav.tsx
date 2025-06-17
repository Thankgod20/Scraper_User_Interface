// src/components/MobileNav.tsx
import React from 'react';
// No need to import LucideProps if we use a more direct type assertion below

interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ReactNode; // The icon itself, e.g., <CandlestickChartIcon />
}

interface MobileNavProps {
  activeView: string;
  onNavClick: (viewId: string) => void;
  navItems: MobileNavItem[];
}

const MobileNav: React.FC<MobileNavProps> = ({ activeView, onNavClick, navItems }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-850 border-t border-gray-700 md:hidden flex justify-around items-center h-16 z-50 shadow-upper">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavClick(item.id)}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-1/4 h-full
                      ${activeView === item.id 
                        ? 'text-blue-400 bg-gray-700/60' 
                        : 'text-gray-400 hover:text-blue-300 hover:bg-gray-700/30'}`}
          aria-label={item.label}
        >
          {/*
            Ensure the icon is a valid React element before cloning.
            Cast item.icon to React.ReactElement whose props are an object
            that can include a 'size' property. Lucide icons fit this.
          */}
          {React.isValidElement(item.icon) && 
            React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 22 })}
          
          <span className="text-[10px] mt-1 font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default MobileNav;