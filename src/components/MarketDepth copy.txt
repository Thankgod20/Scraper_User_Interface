import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface OrderBookEntry {
  price: number;
  amount: number;
}

interface LivePriceEntry {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketDepthChartProps {
  orderBookData: OrderBookEntry[];
  livePriceData: LivePriceEntry[];
}

// Define a type for cumulative data points
interface CumulativeDataPoint {
  price: number;
  cumulative: number;
  amount: number;
  side: 'bid' | 'ask'; // Using 'side' instead of 'type' for clarity
}

// Define a type for voronoi tuple
type VoronoiDataPoint = [number, number, CumulativeDataPoint];

const MarketDepthChart: React.FC<MarketDepthChartProps> = ({ orderBookData, livePriceData }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Track active tooltip data
  const [tooltipData, setTooltipData] = useState<{
    position: { x: number, y: number },
    content: React.ReactNode,
    visible: boolean
  }>({
    position: { x: 0, y: 0 },
    content: null,
    visible: false
  });

  useEffect(() => {
    if (!orderBookData.length || !livePriceData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const currentPrice = livePriceData[0].close;
    
    // Split into bids and asks based solely on current price
    const bids = orderBookData
      .filter(d => d.price <= currentPrice)
      .sort((a, b) => b.price - a.price); // Sort bids descending
      
    const asks = orderBookData
      .filter(d => d.price > currentPrice)
      .sort((a, b) => a.price - b.price); // Sort asks ascending

    // Compute cumulative sums
    let bidCumulative = 0;
    const bidCumData: CumulativeDataPoint[] = bids.map(d => {
      bidCumulative += d.amount;
      return { price: d.price, cumulative: bidCumulative, amount: d.amount, side: 'bid' };
    });

    let askCumulative = 0;
    const askCumData: CumulativeDataPoint[] = asks.map(d => {
      askCumulative += d.amount;
      return { price: d.price, cumulative: askCumulative, amount: d.amount, side: 'ask' };
    });

    // Combine for display purposes
    const allData = [...bids, ...asks];
    const allCumData = [...bidCumData, ...askCumData];

    // Color mapping
    const bidColor = '#10B981'; // green
    const askColor  = '#EF4444'; // red
    const bidAreaColor = 'rgba(16, 185, 129, 0.2)'; // transparent green
    const askAreaColor = 'rgba(239, 68, 68, 0.2)'; // transparent red

    // Calculate domains
    const prices = allData.map(d => d.price);
    const minPrice = Math.min(...prices, currentPrice);
    const maxPrice = Math.max(...prices, currentPrice);
    const padding = (maxPrice - minPrice) * 0.05;
    const domainMin = Math.max(0, minPrice - padding);
    const domainMax = maxPrice + padding;

    const maxAmount = d3.max(allData, d => d.amount) ?? 0;
    const maxCum = d3.max(allCumData, d => d.cumulative) ?? 0;

    const margin = { top: 30, right: 60, bottom: 40, left: 60 };
    const width = svgRef.current?.parentElement?.clientWidth || 500;
    const height = svgRef.current?.parentElement?.clientHeight || 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, maxAmount * 1.1])
      .range([innerHeight, 0]);

    const yScaleCum = d3.scaleLinear()
      .domain([0, maxCum * 1.1])
      .range([innerHeight, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
      
    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => {
        const val = d as number;
        return val.toFixed(val < 1 ? 2 : 0);
      }))
      .attr('color', '#9CA3AF')
      .attr('font-size', '10px')
      .call(g => g.select('.domain').attr('stroke', '#4B5563'));

    // X axis label
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#D1D5DB')
      .attr('font-size', '12px')
      .text('Price');

    // Left axis (amount)
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => {
        const v = d as number;
        if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`;
        if (v >= 1e3) return `${(v/1e3).toFixed(1)}K`;
        return v.toString();
      }))
      .attr('color', '#9CA3AF')
      .attr('font-size', '10px')
      .call(g => g.select('.domain').attr('stroke', '#4B5563'));
      
    // Left axis label
    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .attr('fill', '#D1D5DB')
      .attr('font-size', '12px')
      .text('Amount');

    // Right axis (cumulative)
    g.append('g')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(d3.axisRight(yScaleCum).ticks(5).tickFormat(d => {
        const v = d as number;
        if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`;
        if (v >= 1e3) return `${(v/1e3).toFixed(1)}K`;
        return v.toString();
      }))
      .attr('color', '#9CA3AF')
      .attr('font-size', '10px')
      .call(g => g.select('.domain').attr('stroke', '#4B5563'));
      
    // Right axis label
    g.append('text')
      .attr('class', 'y-axis-label-right')
      .attr('transform', 'rotate(90)')
      .attr('x', innerHeight / 2)
      .attr('y', -innerWidth - 45)
      .attr('text-anchor', 'middle')
      .attr('fill', '#D1D5DB')
      .attr('font-size', '12px')
      .text('Cumulative Amount');

    // Add grid lines for better readability
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(xScale.ticks(10))
      .enter()
      .append('line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#374151')
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '3,3');

    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#374151')
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '3,3');

    // Add bars
    g.selectAll('.bid-bar')
      .data(bids)
      .enter()
      .append('rect')
      .attr('class', 'bid-bar')
      .attr('x', d => xScale(d.price) - (innerWidth / allData.length / 2))
      .attr('y', d => yScale(d.amount))
      .attr('width', innerWidth / allData.length)
      .attr('height', d => innerHeight - yScale(d.amount))
      .attr('fill', bidColor)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('cursor', 'pointer')
      .on('mouseover', (event, d) => handleMouseOver(event, d, 'bid'))
      .on('mouseout', handleMouseOut);
      
    g.selectAll('.ask-bar')
      .data(asks)
      .enter()
      .append('rect')
      .attr('class', 'ask-bar')
      .attr('x', d => xScale(d.price) - (innerWidth / allData.length / 2))
      .attr('y', d => yScale(d.amount))
      .attr('width', innerWidth / allData.length)
      .attr('height', d => innerHeight - yScale(d.amount))
      .attr('fill', askColor)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('cursor', 'pointer')
      .on('mouseover', (event, d) => handleMouseOver(event, d, 'ask'))
      .on('mouseout', handleMouseOut);

    // Bid area
    const bidAreaGenerator = d3.area<CumulativeDataPoint>()
      .x(d => xScale(d.price))
      .y0(innerHeight)
      .y1(d => yScaleCum(d.cumulative))
      .curve(d3.curveMonotoneX);

    // Ask area
    const askAreaGenerator = d3.area<CumulativeDataPoint>()
      .x(d => xScale(d.price))
      .y0(innerHeight)
      .y1(d => yScaleCum(d.cumulative))
      .curve(d3.curveMonotoneX);

    // Add bid area
    g.append('path')
      .datum(bidCumData)
      .attr('fill', bidAreaColor)
      .attr('d', bidAreaGenerator);

    // Add ask area
    g.append('path')
      .datum(askCumData)
      .attr('fill', askAreaColor)
      .attr('d', askAreaGenerator);

    // Bid line
    const bidLineGenerator = d3.line<CumulativeDataPoint>()
      .x(d => xScale(d.price))
      .y(d => yScaleCum(d.cumulative))
      .curve(d3.curveMonotoneX);

    // Ask line
    const askLineGenerator = d3.line<CumulativeDataPoint>()
      .x(d => xScale(d.price))
      .y(d => yScaleCum(d.cumulative))
      .curve(d3.curveMonotoneX);

    // Add bid line
    g.append('path')
      .datum(bidCumData)
      .attr('fill', 'none')
      .attr('stroke', bidColor)
      .attr('stroke-width', 2)
      .attr('d', bidLineGenerator)
      .attr('class', 'bid-line');

    // Add ask line
    g.append('path')
      .datum(askCumData)
      .attr('fill', 'none')
      .attr('stroke', askColor)
      .attr('stroke-width', 2)
      .attr('d', askLineGenerator)
      .attr('class', 'ask-line');

    // Add interactive points to cumulative lines
    g.selectAll('.bid-point')
      .data(bidCumData)
      .enter()
      .append('circle')
      .attr('class', 'bid-point')
      .attr('cx', d => xScale(d.price))
      .attr('cy', d => yScaleCum(d.cumulative))
      .attr('r', 3)
      .attr('fill', bidColor)
      .attr('opacity', 0) // Hidden by default
      .attr('cursor', 'pointer')
      .on('mouseover', handleCumulativeMouseOver)
      .on('mouseout', handleMouseOut);

    g.selectAll('.ask-point')
      .data(askCumData)
      .enter()
      .append('circle')
      .attr('class', 'ask-point')
      .attr('cx', d => xScale(d.price))
      .attr('cy', d => yScaleCum(d.cumulative))
      .attr('r', 3)
      .attr('fill', askColor)
      .attr('opacity', 0) // Hidden by default
      .attr('cursor', 'pointer')
      .on('mouseover', handleCumulativeMouseOver)
      .on('mouseout', handleMouseOut);
      
    // Add voronoi overlay for better tooltips on cumulative lines
    const voronoiData: VoronoiDataPoint[] = [...bidCumData, ...askCumData].map(
      d => [xScale(d.price), yScaleCum(d.cumulative), d]
    );
    
    const voronoi = d3.Delaunay
      .from(voronoiData, d => d[0], d => d[1])
      .voronoi([0, 0, innerWidth, innerHeight]);
      
    g.append('g')
      .attr('class', 'voronoi')
      .selectAll('path')
      .data(voronoiData)
      .enter()
      .append('path')
      .attr('d', (_, i) => voronoi.renderCell(i))
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .attr('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        // d is now properly typed as VoronoiDataPoint
        const dataPoint = d[2]; // This is the CumulativeDataPoint
        
        // Now we can safely access dataPoint.side
        d3.selectAll(`.${dataPoint.side}-point`)
          .filter(pd => (pd as CumulativeDataPoint).price === dataPoint.price)
          .attr('opacity', 1)
          .attr('r', 5);
          
        const tooltipContent = (
          <>
            <div className={`font-bold ${dataPoint.side === 'bid' ? 'text-green-500' : 'text-red-500'}`}>
              {dataPoint.side === 'bid' ? 'Bid' : 'Ask'} (Cumulative)
            </div>
            <p className="font-bold">Price: {dataPoint.price.toFixed(8)}</p>
            <p>Amount: {formatAmount(dataPoint.amount)}</p>
            <p>Cumulative: {formatAmount(dataPoint.cumulative)}</p>
            {/* Added percentage of total volume */}
            <p className="text-gray-300">
              % of Total Volume: {((dataPoint.cumulative / maxCum) * 100).toFixed(2)}%
            </p>
            {/* Added price difference from current */}
            <p className={dataPoint.price > currentPrice ? 'text-red-400' : 'text-green-400'}>
              Diff from Current: {((dataPoint.price - currentPrice) / currentPrice * 100).toFixed(2)}%
            </p>
          </>
        );
        
        setTooltipData({
          position: { x: event.pageX, y: event.pageY },
          content: tooltipContent,
          visible: true
        });
      })
      .on('mouseout', handleMouseOut);

    // Current price line & label
    g.append('line')
      .attr('x1', xScale(currentPrice))
      .attr('x2', xScale(currentPrice))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1.5);

    g.append('text')
      .attr('x', xScale(currentPrice) + 5)
      .attr('y', 15)
      .attr('fill', '#FFFFFF')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(`Current: ${currentPrice.toFixed(8)}`);

    // Add vertical crosshair
    const verticalCrosshair = g.append('line')
      .attr('class', 'crosshair')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1)
      .attr('opacity', 0);
      
    // Add horizontal crosshair
    const horizontalCrosshair = g.append('line')
      .attr('class', 'crosshair')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1)
      .attr('opacity', 0);
      
    // Price indicator at crosshair
    const priceIndicator = g.append('text')
      .attr('class', 'price-indicator')
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '10px')
      .attr('opacity', 0);
      
    // Value indicator at crosshair
    const valueIndicator = g.append('text')
      .attr('class', 'value-indicator')
      .attr('text-anchor', 'end')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '10px')
      .attr('opacity', 0);
    
    // Overlay for crosshair
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function(event) {
        const [mouseX, mouseY] = d3.pointer(event);
        
        if (mouseX < 0 || mouseX > innerWidth || mouseY < 0 || mouseY > innerHeight) {
          hideCrosshair();
          return;
        }
        
        showCrosshair(mouseX, mouseY);
        
        const price = xScale.invert(mouseX);
        const amount = yScale.invert(mouseY);
        const cumAmount = yScaleCum.invert(mouseY);
        
        // Find closest data point
        let closestBid = bidCumData.reduce((prev, curr) => 
          Math.abs(curr.price - price) < Math.abs(prev.price - price) ? curr : prev, bidCumData[0]);
        
        let closestAsk = askCumData.reduce((prev, curr) => 
          Math.abs(curr.price - price) < Math.abs(prev.price - price) ? curr : prev, askCumData[0]);
        
        let closest = Math.abs(closestBid.price - price) < Math.abs(closestAsk.price - price) ? 
          closestBid : closestAsk;
        
        const tooltipContent = (
          <>
            <div className="font-bold text-blue-400">Chart Position</div>
            <p className="font-bold">Price: {price.toFixed(8)}</p>
            <p>Amount: {formatAmount(amount)}</p>
            <p>Cumulative: {formatAmount(cumAmount)}</p>
            <div className="border-t border-gray-600 my-1"></div>
            <div className={`font-bold ${closest.side === 'bid' ? 'text-green-500' : 'text-red-500'}`}>
              Nearest {closest.side === 'bid' ? 'Support' : 'Resistance'}
            </div>
            <p>Price: {closest.price.toFixed(8)}</p>
            <p>Amount: {formatAmount(closest.amount)}</p>
            <p>Cumulative: {formatAmount(closest.cumulative)}</p>
          </>
        );
        
        setTooltipData({
          position: { x: event.pageX, y: event.pageY },
          content: tooltipContent,
          visible: true
        });
      })
      .on('mouseout', function() {
        hideCrosshair();
        handleMouseOut();
      });
    
    function showCrosshair(x: number, y: number) {
      verticalCrosshair
        .attr('x1', x)
        .attr('x2', x)
        .attr('opacity', 0.5);
        
      horizontalCrosshair
        .attr('y1', y)
        .attr('y2', y)
        .attr('opacity', 0.5);
        
      priceIndicator
        .attr('x', x)
        .attr('y', innerHeight + 15)
        .text(`${xScale.invert(x).toFixed(8)}`)
        .attr('opacity', 1);
        
      valueIndicator
        .attr('x', -5)
        .attr('y', y + 4)
        .text(`${formatAmount(yScale.invert(y))}`)
        .attr('opacity', 1);
    }
    
    function hideCrosshair() {
      verticalCrosshair.attr('opacity', 0);
      horizontalCrosshair.attr('opacity', 0);
      priceIndicator.attr('opacity', 0);
      valueIndicator.attr('opacity', 0);
    }

    // Legend
    const legendWidth = 220; // adjust as needed for your legend contents
    const legendX = (innerWidth - legendWidth) / 2; // centers the legend horizontally
    const legendY = innerHeight + 40; 
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX}, ${legendY})`);

    // Bid legend
    legend.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', bidColor);

    legend.append('text')
      .attr('x', 18)
      .attr('y', 9)
      .attr('fill', '#D1D5DB')
      .attr('font-size', '10px')
      .text('Gains');

    // Ask legend
    legend.append('rect')
      .attr('x', 60)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', askColor);

    legend.append('text')
      .attr('x', 78)
      .attr('y', 9)
      .attr('fill', '#D1D5DB')
      .attr('font-size', '10px')
      .text('Loss');

    // Cumulative legend
    legend.append('line')
      .attr('x1', 120)
      .attr('x2', 132)
      .attr('y1', 6)
      .attr('y2', 6)
      .attr('stroke', '#3B82F6')
      .attr('stroke-width', 2);

    legend.append('text')
      .attr('x', 138)
      .attr('y', 9)
      .attr('fill', '#D1D5DB')
      .attr('font-size', '10px')
      .text('Cumulative');

    // Title
    g.append('text')
      .attr('class', 'chart-title')
      .attr('x', innerWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#D1D5DB')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .text('Market Depth Chart');

    function handleMouseOver(event: any, d: OrderBookEntry, side: 'bid' | 'ask') {
      const tooltipContent = (
        <>
          <div className={`font-bold ${side === 'bid' ? 'text-green-500' : 'text-red-500'}`}>
            {side === 'bid' ? 'Bid' : 'Ask'}
          </div>
          <p className="font-bold">Price: {d.price.toFixed(8)}</p>
          <p>Amount: {formatAmount(d.amount)}</p>
          <div className="border-t border-gray-600 my-1"></div>
          <p className={side === 'bid' ? 'text-green-400' : 'text-red-400'}>
            {side === 'bid' 
              ? `-${((currentPrice - d.price) / currentPrice * 100).toFixed(2)}% from current` 
              : `+${((d.price - currentPrice) / currentPrice * 100).toFixed(2)}% from current`}
          </p>
        </>
      );
      
      setTooltipData({
        position: { x: event.pageX, y: event.pageY },
        content: tooltipContent,
        visible: true
      });
      
      // Highlight the bar
      d3.select(event.target)
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1);
    }

    function handleCumulativeMouseOver(event: any, d: CumulativeDataPoint) {
      d3.select(event.target)
        .attr('opacity', 1)
        .attr('r', 5);
        
      const tooltipContent = (
        <>
          <div className={`font-bold ${d.side === 'bid' ? 'text-green-500' : 'text-red-500'}`}>
            {d.side === 'bid' ? 'Bid' : 'Ask'} (Cumulative)
          </div>
          <p className="font-bold">Price: {d.price.toFixed(8)}</p>
          <p>Amount: {formatAmount(d.amount)}</p>
          <p>Cumulative: {formatAmount(d.cumulative)}</p>
          <div className="border-t border-gray-600 my-1"></div>
          <p className="text-gray-300">
            % of Total Volume: {((d.cumulative / maxCum) * 100).toFixed(2)}%
          </p>
          <p className={d.price > currentPrice ? 'text-red-400' : 'text-green-400'}>
            Diff from Current: {((d.price - currentPrice) / currentPrice * 100).toFixed(2)}%
          </p>
        </>
      );
      
      setTooltipData({
        position: { x: event.pageX, y: event.pageY },
        content: tooltipContent,
        visible: true
      });
    }

    function handleMouseOut() {
      d3.selectAll('.bid-point, .ask-point')
        .attr('opacity', 0)
        .attr('r', 3);
      
      d3.selectAll('.bid-bar, .ask-bar')
        .attr('stroke', 'none');
      
      setTooltipData(prev => ({
        ...prev,
        visible: false
      }));
    }

  }, [orderBookData, livePriceData]);

  const formatAmount = (amount: number): string => {
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    return amount.toFixed(2);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col w-full">
      <div className="flex-grow relative">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="overflow-visible"
        />
        {/* Enhanced tooltip with React rendering */}
        {tooltipData.visible && (
          <div 
            className="absolute bg-gray-800 text-white p-2 rounded shadow-lg border border-gray-600 text-xs z-10 transition-opacity"
            style={{
              left: tooltipData.position.x -30,
              top: tooltipData.position.y -90,
              maxWidth: '300px',
              backdropFilter: 'blur(8px)',
              opacity: 0.95
            }}
          >
            {tooltipData.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketDepthChart;