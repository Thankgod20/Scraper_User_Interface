import React from "react";

const Header = () => {
    return (
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="text-lg font-bold">advanced</div>
            <div className="flex items-center space-x-4">
                <a href="#" className="text-sm text-gray-400">[how it works]</a>
                <a href="#" className="text-sm text-gray-400">[support]</a>
                <div className="flex items-center space-x-2">
                    <button className="w-5 h-5 rounded-full bg-gray-700" />
                    <button className="w-5 h-5 rounded-full bg-gray-700" />
                    <button className="w-5 h-5 rounded-full bg-gray-700" />
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <input
                    type="text"
                    placeholder="search for token"
                    className="px-2 py-1 rounded bg-gray-800 text-sm border border-gray-700"
                />
                <button className="text-sm text-gray-400">[connect wallet]</button>
            </div>
        </header>
    );
};

export default Header;
