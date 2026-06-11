import { Router } from "express";
import config, { isLiveProviderReady } from "../config.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    demo_mode: config.demoMode,
    provider_configured: isLiveProviderReady(),
    max_upload_mb: config.maxUploadMb,
    min_sample_seconds: config.minSampleSeconds,
    max_text_length: config.maxTextLength
  });
});

export default router;
