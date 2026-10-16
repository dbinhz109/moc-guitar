import studio from "../studio.html?raw";
export const dynamic = "force-dynamic";
export function GET() {
  return new Response(studio, {headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
