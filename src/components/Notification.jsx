import { useState, useEffect } from 'react';

function Notification({ message, type = 'success', duration = 5000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`notification ${type}`}>
      <p>{message}</p>
      <button onClick={() => setIsVisible(false)} className="close-btn">
        ×
      </button>
    </div>
  );
}

export default Notification; 