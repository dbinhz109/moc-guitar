import { authenticate, failure, logout, me, reply } from "../../../../lib/account";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if(new URL(request.url).pathname!=="/api/auth/me")return reply({error:"not_found"},404);
  try{return await me(request)}catch(error){return failure(error)}
}
export async function POST(request: Request) {
  const action=new URL(request.url).pathname.split("/").pop();
  try{
    if(action==="register")return await authenticate(request,true);
    if(action==="login")return await authenticate(request,false);
    if(action==="logout")return await logout(request);
    return reply({error:"not_found"},404);
  }catch(error){return failure(error)}
}
