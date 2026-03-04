const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const API_TIMEOUT = Number(process.env.EXPO_PUBLIC_API_TIMEOUT || 10000);

const ENV = {
  API_URL,
  API_TIMEOUT,
};

export default ENV;
