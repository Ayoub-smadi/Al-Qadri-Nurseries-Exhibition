export default function handler(_req: any, res: any) {
  res.status(501).json({ error: "Storage not supported in this deployment" });
}
