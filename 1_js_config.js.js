const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxAT24-vusBHxGlHq4wBlUJupP07pU72MQtwhk5gzovkOk7Llkvy76PuGFbdZ_872zGkw/exec",
  DRIVE_FOLDER_ID: "1J8lyAOWWlXEVvh0mWibZya_PyjhTrjwJ",
  APP_NAME: "ระบบรายงานผลการปฏิบัติงาน PA ครู",
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp", "application/pdf", 
                  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
};

// Helper เรียก API แบบ text/plain เลี่ยง CORS preflight
async function callAPI(action, payload = {}, method = "POST") {
  const url = `${CONFIG.API_URL}?action=${encodeURIComponent(action)}`;
  const options = {
    method: method,
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    }
  };
  
  if (method === "POST" || method === "post") {
    options.body = JSON.stringify({ ...payload, action });
  }
  
  const response = await fetch(url, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: false, message: "Invalid JSON response", raw: text };
  }
}