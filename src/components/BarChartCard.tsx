import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, annotationPlugin);

interface HolderData {
  price: number;
  amount: number;
}

interface LivePriceData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BarChartCardProps {
  holdersData: HolderData[];
  livePrices: LivePriceData[];
}

const BarChartCard: React.FC<BarChartCardProps> = ({ holdersData, livePrices }) => {
  // Use the close value of the last element as the current price
  const currentPrice = livePrices.length > 0 ? livePrices[livePrices.length - 1].close : 0;

  // Prepare the labels (price strings) and amounts for the chart.
  const labels = holdersData.map(data => data.price.toFixed(8));
  const amounts = holdersData.map(data => data.amount);

  // Bar colors: green if the bar's price is greater than currentPrice, red otherwise.
  const backgroundColors = holdersData.map(data =>
    data.price > currentPrice
      ? 'rgba(16, 185, 129, 0.7)'  // green
      : 'rgba(239, 68, 68, 0.7)'    // red
  );

  // Chart.js data object.
  const data = {
    labels,
    datasets: [
      {
        label: 'Amount',
        data: amounts,
        backgroundColor: backgroundColors,
      },
    ],
  };

  // Configuration options, including the annotation plugin for the dashed line.
  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      // Annotation plugin config: add a horizontal dashed line for the current price.
      annotation: {
        annotations: {
          currentPriceLine: {
            type: 'line',
            yMin: currentPrice,
            yMax: currentPrice,
            borderColor: 'rgba(255, 255, 255, 0.8)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              display: true,
              content: `Current: ${currentPrice}`,
              position: 'end',
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#fff',
            },
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Price' },
      },
      y: {
        title: { display: true, text: 'Amount' },
      },
    },
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-lg">
      <h3 className="text-lg font-bold mb-2">Holders Price Distribution</h3>
      <Bar data={data} options={options} />
    </div>
  );
};

export default BarChartCard;
