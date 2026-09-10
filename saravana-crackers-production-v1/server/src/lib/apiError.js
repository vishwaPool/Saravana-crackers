export function apiError(error) {
  const connectionCode = error.code || error.errorCode;
  if (error.name === "PrismaClientInitializationError" || ["P1000", "P1001", "P1002", "P1008", "P1011", "P1017"].includes(connectionCode)) {
    return {status:503,message:"The database connection is unavailable. Please ask the administrator to check the database service and connection settings, then retry."};
  }
  if (["P2028", "P2024", "P2034"].includes(error.code)) return {status:503,message:"The database could not finish this operation. Your bill is still on screen. Please retry; the same bill will not be charged twice."};
  if (error.code === "P2002") return {status:409,message:"A record with these details already exists. Check the code or name."};
  if (error.code === "P2003") return {status:400,message:"The selected category, product or supplier is unavailable. Refresh and select again."};
  if (error.code === "P2025") return {status:404,message:"This record is no longer available. Refresh the page."};
  if (/^P\d{4}$/.test(error.code || "")) return {status:500,message:"The database request failed. Please try again or contact the administrator."};
  const message=error.message || "Request failed";
  return {status:/not found|unavailable/i.test(message)?404:/stock|duplicate|already|changed/i.test(message)?409:/auth|permission/i.test(message)?403:400,message};
}
