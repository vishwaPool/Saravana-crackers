import {useState} from "react";
import StoreIcon from "./StoreIcon";
export default function StoreImage({src, alt, ...props}) {
  const [failed, setFailed] = useState(null);
  if (!src || failed === src) return <span className="store-image-placeholder" role="img" aria-label={`${alt} — image unavailable`}><StoreIcon width="40" height="40"/></span>;
  return <img src={src} alt={alt} loading="lazy" {...props} onError={() => setFailed(src)}/>;
}
