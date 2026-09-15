const { logGuruAIActivity } = require("../services/guruaiActivityLogger");

module.exports = function guruAIActivityLogger(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (payload) {
    const result = originalJson(payload);

    const route = req.path;

    if (
      req.method === "POST" &&
      (
        route === "/chat" ||
        route === "/document-chat" ||
        route === "/upload"
      )
    ) {
      setImmediate(async () => {
        try {
          const isUpload = route === "/upload";

          const question = isUpload
            ? ""
            : (req.body?.message || "");

          const answer = isUpload
            ? (
                payload?.filename
                  ? `Document uploaded: ${payload.filename}`
                  : (payload?.message || "")
              )
            : (
                payload?.reply ||
                payload?.message ||
                ""
              );

          const type =
            route === "/chat"
              ? "AI Chat"
              : route === "/document-chat"
                ? "Document Chat"
                : "Document Upload";

          const documentName =
            payload?.filename ||
            req.body?.documentName ||
            "";

          const documentId =
            payload?.documentId ||
            req.body?.documentId ||
            "";

          const status =
            payload?.success === false
              ? "ERROR"
              : "SUCCESS";

          await logGuruAIActivity({
            req,
            question,
            answer,
            type,
            documentName,
            documentId,
            status
          });

        } catch (error) {
          console.error(
            "GuruAI activity logging failed:",
            error.message
          );
        }
      });
    }

    return result;
  };

  next();
};
