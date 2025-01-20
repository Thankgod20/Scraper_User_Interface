// components/Chart.tsx
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import React, { useEffect, useState } from "react";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);



interface ChartProps {
    name: any;
    symbol: any;
}
const Chart: React.FC<ChartProps> = ({ name, symbol }) => {
    const options = {
        responsive: true,
        plugins: {
            legend: { position: 'top' as const },
            title: { display: true, text: name + ' Chart' },
        },
    };
    const data = {
        labels: ['23:00', '23:05', '23:10'], // X-axis labels (time)
        datasets: [
            {
                label: symbol,
                data: [0.0000002, 0.00000025, 0.000000283], // Replace with dynamic data
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
            },
        ],
    };
    return <Bar options={options} data={data} />;
};

export default Chart;
