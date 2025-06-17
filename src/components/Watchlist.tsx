// src/components/Watchlist.tsx
"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Search, PlusCircle, Settings2, Columns, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';

interface Coin {
  address: string;
  name: string;
  symbol: string;
  index: number;
  added_at: string;
  last_activity: string;
}

type SortField = 'symbol' | 'added_at' | 'last_activity' | 'index';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

const Watchlist: React.FC = () => {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [filteredCoins, setFilteredCoins] = useState<Coin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'index', direction: 'asc' });
  
  // Configurable refresh interval (in milliseconds)
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds default
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const params = useParams();
  const currentAddress = params?.address as string;

  const fetchCoins = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    
    try {
      // NOTE: Using a CORS proxy for development if the API doesn't have CORS headers.
      // In production, ensure the API server has proper CORS configuration.
      // const response = await fetch(`https://cors-anywhere.herokuapp.com/http://51.20.10.190:3300/addresses/address.json`);
      // For now, assuming direct access or a local proxy is set up.
      const response = await fetch(`http://51.20.10.190:3300/addresses/address.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Coin[] = await response.json();
      setCoins(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch coins:", e);
      setError("Failed to load watchlist. Please try again later.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Sorting function
  const sortCoins = useCallback((coinsToSort: Coin[], config: SortConfig): Coin[] => {
    return [...coinsToSort].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (config.field) {
        case 'symbol':
          aValue = (a.symbol || a.name || a.address).toLowerCase();
          bValue = (b.symbol || b.name || b.address).toLowerCase();
          break;
        case 'added_at':
          aValue = new Date(a.added_at).getTime();
          bValue = new Date(b.added_at).getTime();
          break;
        case 'last_activity':
          aValue = new Date(a.last_activity).getTime();
          bValue = new Date(b.last_activity).getTime();
          break;
        case 'index':
        default:
          aValue = a.index;
          bValue = b.index;
          break;
      }

      if (aValue < bValue) {
        return config.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return config.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, []);

  // Handle sort click
  const handleSort = (field: SortField) => {
    setSortConfig(prevConfig => ({
      field,
      direction: prevConfig.field === field && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Initial fetch
  useEffect(() => {
    fetchCoins(false);
  }, [fetchCoins]);

  // Set up periodic refresh
  useEffect(() => {
    if (isAutoRefreshEnabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchCoins(true);
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchCoins, refreshInterval, isAutoRefreshEnabled]);

  // Filter and sort coins based on search term and sort configuration
  useEffect(() => {
    let filtered = coins;
    
    if (searchTerm !== '') {
      filtered = coins.filter(coin =>
        coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coin.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    const sorted = sortCoins(filtered, sortConfig);
    setFilteredCoins(sorted);
  }, [searchTerm, coins, sortConfig, sortCoins]);

  const handleCoinSelect = (address: string) => {
    router.push(`./${address}`);
  };

  const handleManualRefresh = () => {
    fetchCoins(false);
  };

  const toggleAutoRefresh = () => {
    setIsAutoRefreshEnabled(!isAutoRefreshEnabled);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) {
        return `${diffInSeconds}s`;
      } else if (diffInSeconds < 3600) {
        return `${Math.floor(diffInSeconds / 60)}m`;
      } else if (diffInSeconds < 86400) {
        return `${Math.floor(diffInSeconds / 3600)}h`;
      } else {
        return `${Math.floor(diffInSeconds / 86400)}d`;
      }
    } catch (e) {
      return '--';
    }
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else {
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    }
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortConfig.field !== field) {
      return <div className="w-3 h-3"></div>; // Placeholder to maintain alignment
    }
    
    return sortConfig.direction === 'asc' ? 
      <ChevronUp size={12} className="text-blue-400" /> : 
      <ChevronDown size={12} className="text-blue-400" />;
  };

  return (
    <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-2xl h-full flex flex-col text-sm">
      <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gray-800/60 rounded-t-xl">
        <h2 className="text-base font-semibold text-gray-200">? Watch List</h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleManualRefresh}
            disabled={isLoading || isRefreshing}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh manually"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={toggleAutoRefresh}
            className={`transition-colors ${isAutoRefreshEnabled ? 'text-green-400 hover:text-green-300' : 'text-gray-400 hover:text-white'}`}
            title={`Auto-refresh: ${isAutoRefreshEnabled ? 'ON' : 'OFF'}`}
          >
            <div className={`w-2 h-2 rounded-full ${isAutoRefreshEnabled ? 'bg-green-400' : 'bg-gray-400'}`}></div>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            <PlusCircle size={18} />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            <Columns size={16} />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-gray-700/50">
        <div className="relative">
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-700/50 border border-gray-600/70 rounded-md py-1.5 px-3 pl-8 text-gray-200 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
          />
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        
        {/* Refresh controls */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <div className="flex items-center space-x-2">
            <label className="text-gray-400">Refresh every:</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-gray-700/50 border border-gray-600/70 rounded px-2 py-1 text-gray-200 text-xs"
            >
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
              <option value={300000}>5m</option>
              <option value={900000}>15m</option>
            </select>
          </div>
          <div className="text-gray-500">
            {lastUpdated && formatLastUpdated(lastUpdated)}
          </div>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {isLoading && <div className="p-4 text-center text-gray-400">Loading watchlist...</div>}
        {error && <div className="p-4 text-center text-red-400">{error}</div>}
        {!isLoading && !error && (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-800/80 backdrop-blur-sm">
              <tr>
                <th 
                  className="px-3 py-2 text-left font-medium text-gray-400 text-xs w-2/5 cursor-pointer hover:text-gray-200 transition-colors select-none"
                  onClick={() => handleSort('symbol')}
                >
                  <div className="flex items-center justify-between">
                    <span>SYMBOL</span>
                    <SortIcon field="symbol" />
                  </div>
                </th>
                <th 
                  className="px-3 py-2 text-right font-medium text-gray-400 text-xs w-3/10 cursor-pointer hover:text-gray-200 transition-colors select-none"
                  onClick={() => handleSort('added_at')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>ADDED</span>
                    <SortIcon field="added_at" />
                  </div>
                </th>
                <th 
                  className="px-3 py-2 text-right font-medium text-gray-400 text-xs w-3/10 cursor-pointer hover:text-gray-200 transition-colors select-none"
                  onClick={() => handleSort('last_activity')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>ACTIVITY</span>
                    <SortIcon field="last_activity" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCoins.map((coin) => (
                <tr
                  key={coin.address}
                  onClick={() => handleCoinSelect(coin.address)}
                  className={`cursor-pointer hover:bg-gray-700/50 transition-colors ${currentAddress === coin.address ? 'bg-blue-600/30' : ''}`}
                >
                  <td className="px-3 py-1.5 text-gray-200 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${currentAddress === coin.address ? 'bg-blue-400' : 'bg-gray-500'}`}></span>
                      {coin.symbol || coin.name || coin.address.substring(0,6)}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-300 text-xs">
                    {formatTimeAgo(coin.added_at)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-300 text-xs">
                    {formatTimeAgo(coin.last_activity)}
                  </td>
                </tr>
              ))}
              {filteredCoins.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-400">No symbols found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <div className="p-2 border-t border-gray-700/50 text-xs text-gray-500 text-center flex items-center justify-between">
        <span>{coins.length} markets</span>
        {isRefreshing && (
          <span className="text-blue-400 flex items-center">
            <RefreshCw size={12} className="animate-spin mr-1" />
            Updating...
          </span>
        )}
      </div>
    </div>
  );
};

export default Watchlist;