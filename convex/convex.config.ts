import { defineApp } from "convex/server";
import { v } from "convex/values";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp({
  env: {
    OPENAI_API_KEY: v.string(),
  },
});

app.use(workpool, { name: "wordProcessing" });

export default app;
