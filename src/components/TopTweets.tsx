import React from "react";

interface TweetCardProps {
    profileImage: string;
    username: string;
    timestamp: string;
    content: string;
    lightningCount: string;
    viewsCount: string;
}

const TweetCard: React.FC<TweetCardProps> = ({
    profileImage,
    username,
    timestamp,
    content,
    lightningCount,
    viewsCount,
}) => {
    return (
        <div className="bg-gray-900 text-white p-4 rounded-lg shadow-md w-[100%] flex-shrink-0 overflow-x-auto">
            {/* Header: Profile and Timestamp */}
            <div className="flex items-center mb-3">
                <img
                    src={profileImage}
                    alt="Profile"
                    className="w-8 h-8 rounded-full mr-2"
                />
                <div>
                    <p className="text-sm font-bold">{username}</p>
                    <p className="text-xs text-gray-400">{timestamp}</p>
                </div>
            </div>

            {/* Content */}
            <p className="text-sm text-gray-300 mb-3">{content}</p>

            {/* Footer: Metrics */}
            <div className="flex justify-between text-xs text-gray-400">
                <div className="flex items-center">
                    <span className="mr-1">⚡</span>
                    <span>{lightningCount}</span>
                </div>
                <div className="flex items-center">
                    <span className="mr-1">👁️</span>
                    <span>{viewsCount}</span>
                </div>
            </div>
        </div>
    );
};
const parseViewsCount = (views: string): number => {
    if (views.endsWith('K')) {
        return parseFloat(views) * 1000; // Convert "2K" to 2000
    } else if (views.endsWith('M')) {
        return parseFloat(views) * 1000000; // Convert "1M" to 1000000
    }
    return parseFloat(views); // For plain numbers
};
interface TweetTopProps {
    username: any[];
    tweets_: any[];
    likes: any[];
    viewscount: any[];
    timestamp: any[];
    profile: any[]
}
const TopTweets: React.FC<TweetTopProps> = ({ username, tweets_, likes, viewscount, timestamp, profile }) => {
    // console.log("viewscount", viewscount[1][viewscount[1].length - 1], viewscount[1].length)

    const tweets = username.map((user, index) => ({
        profileImage: profile[index] ?? "https://via.placeholder.com/40", // Placeholder for now, update if real images are available
        username: user,
        timestamp: timestamp[index], // Example timestamp, you can use a real one if available
        content: tweets_[index],
        //lightningCount: likes[index][likes[index].length - 1], // Assuming `likes` corresponds to lightning reactions
        lightningCount: Array.isArray(likes[index]) && likes[index].length > 0
  ? likes[index][likes[index].length - 1]
  : 0, // fallback if undefined or empty

        viewsCount: Array.isArray(viewscount[index]) ? viewscount[index][0] : "0",
    })).sort((a, b) => parseViewsCount(b.viewsCount) - parseViewsCount(a.viewsCount))
        .slice(0, 10);;
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-white text-lg font-bold mb-4">Top Tweets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tweets.map((tweet, index) => (
                <TweetCard key={index} {...tweet} />
                ))}
            </div>
        </div>
    );
};

export default TopTweets;
