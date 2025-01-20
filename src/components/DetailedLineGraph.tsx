import React from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

// Register Chart.js modules
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface LineGraphProps {
    data: { name: string; value: number }[];
    color?: string; // Default color for the line
    detailed?: boolean; // Toggle for more detailed chart rendering
}

const DLineGraph: React.FC<LineGraphProps> = ({ data, color = "#3B82F6", detailed = false }) => {
    // Transform data for the chart
    const labels = data.map((item) => item.name); // X-axis labels (timestamps)
    const values = data.map((item) => item.value); // Y-axis values

    const chartData = {
        labels,
        datasets: [
            {
                label: "Metric Value",
                data: values,
                borderColor: color,
                backgroundColor: `${color}33`, // Add transparency for fill
                fill: true,
                tension: 0.4, // Smooth curve
                pointRadius: 5, // Point size
                pointBackgroundColor: color,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false, // Allows for custom height
        plugins: {
            legend: {
                display: detailed, // Show legend only for detailed views
                position: "top" as const,
            },
            tooltip: {
                mode: "index" as const,
                intersect: false,
            },
        },
        scales: {
            x: {
                title: {
                    display: detailed, // Show title only for detailed views
                    text: "Timestamp",
                    color: "#ffffff",
                },
                ticks: {
                    color: "#ffffff",
                    maxTicksLimit: detailed ? 10 : 5, // Fewer ticks for non-detailed charts
                },
                grid: {
                    color: "#444",
                },
            },
            y: {
                title: {
                    display: detailed, // Show title only for detailed views
                    text: "Value",
                    color: "#ffffff",
                },
                ticks: {
                    color: "#ffffff",
                },
                grid: {
                    color: "#444",
                },
            },
        },
    };

    return (
        <div
            className="bg-gray-800 rounded-lg p-6 shadow-md"
            style={{
                width: "100%", // Full width
                height: "300px", // Increased height for a bigger chart
            }}
        >
            <Line data={chartData} options={options} />
        </div>
    );
};

export default DLineGraph;
