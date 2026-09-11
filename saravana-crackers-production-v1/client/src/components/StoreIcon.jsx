const paths = {
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  cart: "M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-5 10 3 3 7-7",
  support: "M4 14v-3a8 8 0 0 1 16 0v7c0 3-4 3-8 3M4 11H2v7h4v-7H4Zm16 0h2v7h-4v-7h2Z",
  gift: "M3 8h18v4H3V8Zm2 4v9h14v-9M12 8v13M12 8S3 8 5 3s7 5 7 5 7-10 7-5-7 5-7 5Z",
  instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm2-6h.01",
  facebook: "M14 22V12h4l1-4h-5V6c0-2 1-3 5-2V1C12-1 9 2 9 6v2H6v4h3v10",
  youtube: "M3 5h18v14H3V5Zm7 4 6 3-6 3V9Z",
  whatsapp: "M21 11a9 9 0 0 1-13 8l-6 2 2-6A9 9 0 1 1 21 11ZM8 7c0 5 4 9 9 9l1-3-3-1-1 1-3-3 1-1-1-3-3 1Z"
};
export default function StoreIcon({name = "spark", ...props}) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.spark}/></svg>;
}
