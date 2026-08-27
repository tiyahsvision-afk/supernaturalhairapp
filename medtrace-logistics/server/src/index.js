import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { companiesRouter } from "./routes/companies.js";
import { driversRouter } from "./routes/drivers.js";
import { ordersRouter } from "./routes/orders.js";
import { messagesRouter } from "./routes/messages.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/drivers", driversRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/messages", messagesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`MedTrace Logistics API listening on http://localhost:${PORT}`);
});
