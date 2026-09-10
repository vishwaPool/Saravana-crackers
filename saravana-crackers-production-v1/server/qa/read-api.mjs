import {config} from "dotenv";
config({path:new URL("../.env",import.meta.url),quiet:true});
const {prisma}=await import("../src/lib/prisma.js");
const {default:jwt}=await import("jsonwebtoken");
try{
 const user=await prisma.user.findFirst({where:{active:true,role:{in:["SUPER_ADMIN","ADMIN"]}},select:{id:true,name:true,email:true,role:true}});
 if(!user)throw new Error("No active administrator available for read-only checks.");
 const token=jwt.sign(user,process.env.JWT_SECRET,{expiresIn:"10m"});
 for(const path of ["/auth/me","/admin/dashboard/pos","/admin/products","/admin/products/search?q=a","/admin/categories","/admin/orders","/admin/offers","/admin/customers","/admin/suppliers","/admin/settings","/admin/stock/movements","/admin/held-sales","/admin/sales","/admin/reports/daily","/admin/reports/category-sales","/admin/reports/profit","/admin/audit-logs","/admin/export/stock","/admin/export/sales"]){
  const response=await fetch(`http://localhost:4000/api${path}`,{headers:{cookie:`sc_admin_token=${token}`}});
  console.log(`${response.ok?"PASS":"FAIL"} ${response.status} ${path}`);
  if(!response.ok)process.exitCode=1;
 }
}finally{await prisma.$disconnect()}