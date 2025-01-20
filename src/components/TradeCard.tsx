import React from 'react';

const TradeCard = () => {
    return (
        <div className="bg-gray-800 text-white rounded-lg p-4 shadow-lg max-w-md">
            {/* Buy/Sell Toggle */}
            <div className="flex space-x-2 mb-4">
                <button className="w-1/2 bg-green-500 text-white py-2 rounded-lg font-bold">buy</button>
                <button className="w-1/2 bg-gray-700 text-gray-300 py-2 rounded-lg font-bold">sell</button>
            </div>

            {/* Slippage Setting */}
            <button className="bg-gray-700 text-gray-300 px-4 py-1 rounded-lg text-sm mb-4 w-full">
                set max slippage
            </button>

            {/* Amount Input */}
            <div className="mb-4">
                <div className="flex items-center bg-gray-700 rounded-lg p-2">
                    <input
                        type="number"
                        placeholder="0.00"
                        className="bg-transparent text-white text-xl w-full focus:outline-none"
                    />
                    <span className="text-gray-300 ml-2">SOL</span>
                </div>
            </div>

            {/* Preset Amount Buttons */}
            <div className="flex justify-between mb-4">
                <button className="bg-gray-700 px-3 py-1 rounded-lg">reset</button>
                <button className="bg-gray-700 px-3 py-1 rounded-lg">1 SOL</button>
                <button className="bg-gray-700 px-3 py-1 rounded-lg">5 SOL</button>
                <button className="bg-gray-700 px-3 py-1 rounded-lg">10 SOL</button>
            </div>

            {/* Place Trade Button */}
            <button className="w-full bg-green-500 py-2 rounded-lg text-white font-bold mb-4">
                place trade
            </button>

            {/* Profile Section */}
            <div className="flex items-center mb-4">
                <img
                    src="https://via.placeholder.com/40"
                    alt="Profile"
                    className="w-10 h-10 rounded-full"
                />
                <div className="ml-3">
                    <h3 className="text-lg font-bold">Ropirito (Ropirito)</h3>
                </div>
            </div>

            {/* Progress Bars */}
            <div className="mb-4">
                <div className="flex justify-between items-center text-sm mb-1">
                    <span>bonding curve progress:</span>
                    <span>100%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-lg h-2">
                    <div className="bg-green-500 h-2 rounded-lg" style={{ width: '100%' }}></div>
                </div>
            </div>

            <div className="mb-4">
                <div className="flex justify-between items-center text-sm mb-1">
                    <span>king of the hill progress:</span>
                    <span>100%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-lg h-2">
                    <div className="bg-yellow-500 h-2 rounded-lg" style={{ width: '100%' }}></div>
                </div>
            </div>

            {/* Crown Section */}
            <div className="mb-4">
                <p className="text-sm">
                    👑 crowned king of the hill on <strong>11/12/2024, 3:25:44 PM</strong>
                </p>
            </div>

            {/* Contract Address and Other Links */}
            <div className="mb-4">
                <p className="text-sm text-gray-400">contract address: <span className="text-blue-400">CtaVq...pump</span></p>
            </div>

            {/* Holder Distribution */}
            <div className="flex justify-between text-sm">
                <p>holder distribution</p>
                <p>5.32%</p>
            </div>
            <button className="bg-gray-700 px-3 py-1 rounded-lg mt-2 w-full">
                generate bubble map
            </button>
        </div>
    );
};

export default TradeCard;
