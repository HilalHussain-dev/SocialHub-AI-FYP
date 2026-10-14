const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export const connectFacebook = (): void => {
    window.location.href = `${API_URL}/api/auth/facebook/connect`;
};