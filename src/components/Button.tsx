import React from 'react';

interface ButtonProps {
    label: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ label, onClick, variant = 'primary', fullWidth = false }) => {
    const baseStyles = `py-2 rounded-lg font-bold text-sm`;
    const variantStyles = {
        primary: 'bg-green-500 text-white hover:bg-green-600',
        secondary: 'bg-gray-700 text-gray-300 hover:bg-gray-600',
        danger: 'bg-red-500 text-white hover:bg-red-600',
    };

    const styles = `${baseStyles} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''}`;

    return (
        <button className={styles} onClick={onClick}>
            {label}
        </button>
    );
};

export default Button;
