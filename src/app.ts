import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
import { connectDB } from "./db/connection";

connectDB();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'order-management' });
});

export default app;
