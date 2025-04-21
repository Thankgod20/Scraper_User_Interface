// components/OrderBookCard.tsx
import React, { useMemo } from 'react';

interface OrderData {
  amount: number;
  time: string;
  price: number;
  boughtPrice?: number; // Added bought price field
}

interface OrderBookCardProps {
  orders: OrderData[];
  currentPrice: number;
  totalSupply: number;
}

const OrderBookCard: React.FC<OrderBookCardProps> = ({ orders, currentPrice, totalSupply }) => {
  // Calculate price impact
  const calculatePriceImpact = (order: OrderData) => {
    if (currentPrice === 0) return {percentageImpact: 0, marketImpact: 0};
    
    // Calculate impact as percentage
    const impact = ((order.price - currentPrice) / currentPrice) * 100;
    
    // Calculate market cap impact (token amount / total supply)
    const marketImpact = (order.amount / totalSupply) * 100;
    
    return {
      percentageImpact: impact,
      marketImpact: marketImpact
    };
  };

  // Calculate profit/loss percentage
  const calculateProfitLoss = (order: OrderData) => {
    // If no bought price is available, return null
    if (!order.price || order.price === 0) return null;
    
    // Calculate PnL percentage: (current_price - bought_price) / bought_price * 100
    return ((currentPrice - order.price) / order.price) * 100;
  };

  // Process orders
  const { buyOrders, sellOrders } = useMemo(() => {
    // Sort by price
    const sortedOrders = [...orders].filter(order => order.amount > 0);
    
    // Separate into buy and sell orders relative to current price
    const buys = sortedOrders
      .filter(order => order.price <= currentPrice)
      .sort((a, b) => b.price - a.price); // Highest buy first
    
    const sells = sortedOrders
      .filter(order => order.price > currentPrice)
      .sort((a, b) => a.price - b.price); // Lowest sell first
    
    return {
      buyOrders: buys.slice(0, 8), // Take top 8 orders
      sellOrders: sells.slice(0, 8) // Take top 8 orders
    };
  }, [orders, currentPrice]);

  // Format numbers
  const formatNumber = (num: number, precision = 8) => {
    if (num === 0) return '0';
    if (num < 0.00000001) return num.toExponential(2);
    return num.toFixed(precision);
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);  
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-500';
    if (impact < 0) return 'text-red-500';
    return 'text-gray-400';
  };

  const getProfitLossColor = (pnl: number | null) => {
    if (pnl === null) return 'text-gray-400';
    if (pnl > 0) return 'text-green-500';
    if (pnl < 0) return 'text-red-500';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-900 border border-gray-700 text-white shadow-lg rounded-lg">
      <div className="p-4 pb-2 border-b border-gray-800">
        <div className="text-lg font-bold flex justify-between items-center">
          <span>Order Book</span>
          <span className="text-sm bg-gray-800 px-2 py-1 rounded">
            Current: ${formatNumber(currentPrice)}
          </span>
        </div>
      </div>
      <div className="p-4 pt-0">
        {/* Column Headers */}
        <div className="grid grid-cols-5 text-xs text-gray-400 py-1 border-b border-gray-700 mb-2">
          <div>Price</div>
          <div>Amount</div>
          <div>Impact</div>
          <div>P/L %</div>
          <div>Time</div>
        </div>

        {/* Sell Orders (Red) */}
        <div className="mb-4">
          {sellOrders.map((order, idx) => {
            const impact = calculatePriceImpact(order);
            const profitLoss = calculateProfitLoss(order);
            return (
              <div key={"sell-order-" + idx} className="grid grid-cols-5 text-xs border-b border-gray-800 py-1">
                <div className="text-red-500">${formatNumber(order.price)}</div>
                <div className="ml-4">{formatLargeNumber(order.amount)}</div>
                <div className={getImpactColor(impact.percentageImpact)}>
                  {impact.percentageImpact > 0 ? '+' : ''}{impact.percentageImpact.toFixed(2)}%
                </div>
                <div className={getProfitLossColor(profitLoss)}>
                  {profitLoss !== null ? (profitLoss > 0 ? '+' : '') + profitLoss.toFixed(2) + '%' : '-'}
                </div>
                <div className="text-gray-400">{formatDate(order.time)}</div>
              </div>
            );
          })}
        </div>

        {/* Spread Indicator */}
        <div className="text-xs text-center mb-4 bg-gray-800 py-1 rounded">
          {sellOrders.length > 0 && buyOrders.length > 0 ? (
            <>
              Spread: ${formatNumber(sellOrders[0].price - buyOrders[0].price)} 
              ({((sellOrders[0].price / buyOrders[0].price - 1) * 100).toFixed(2)}%)
            </>
          ) : (
            'Insufficient order data'
          )}
        </div>

        {/* Buy Orders (Green) */}
        <div>
          {buyOrders.map((order, idx) => {
            const impact = calculatePriceImpact(order);
            const profitLoss = calculateProfitLoss(order);
            return (
              <div key={"buy-order-" + idx} className="grid grid-cols-5 text-xs border-b border-gray-800 py-1">
                <div className="text-green-500">${formatNumber(order.price)}</div>
                <div className="ml-4">{formatLargeNumber(order.amount)}</div>
                <div className={getImpactColor(impact.percentageImpact)}>
                  {impact.percentageImpact > 0 ? '+' : ''}{impact.percentageImpact.toFixed(2)}%
                </div>
                <div className={getProfitLossColor(profitLoss)}>
                  {profitLoss !== null ? (profitLoss > 0 ? '+' : '') + profitLoss.toFixed(2) + '%' : '-'}
                </div>
                <div className="text-gray-400">{formatDate(order.time)}</div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-4 text-xs text-gray-400 bg-gray-800 p-2 rounded">
          <div className="flex justify-between mb-1">
            <span>Buy Volume:</span>
            <span>{formatLargeNumber(buyOrders.reduce((sum, order) => sum + order.amount, 0))}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Sell Volume:</span>
            <span>{formatLargeNumber(sellOrders.reduce((sum, order) => sum + order.amount, 0))}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Supply:</span>
            <span>{formatLargeNumber(totalSupply)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBookCard;