import aerial from "./categories/category-aerial-shots.webp.png";
import bijili from "./categories/category-bijili.webp.png";
import combo from "./categories/category-combo-pack.webp.png";
import electric from "./categories/category-electric.webp.png";
import fancy from "./categories/category-fancy.webp.png";
import flash from "./categories/category-flash-light.webp.png";
import flower from "./categories/category-flower-pots.webp.png";
import gift from "./categories/category-gift-box.webp.png";
import ground from "./categories/category-ground-chakkar.webp.png";
import rockets from "./categories/category-rockets.webp.png";
import sound from "./categories/category-sound.webp.png";
import wala from "./categories/product-5000-wala.png";

export const normalizeCategory = (name = "") => name.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
export const categoryImages = {
  "aerial shots": aerial, bijili, "combo packs": combo, "electric crackers": electric,
  "fancy crackers": fancy, "flash light crackers": flash, "flower pots": flower,
  "gift boxes": gift, "ground chakkars": ground, rockets, "sound crackers": sound, "wala crackers": wala
};
export function categoryImage(category, products = []) {
  return categoryImages[normalizeCategory(category.name)] || categoryImages[normalizeCategory(category.slug)] || category.imageUrl ||
    products.find(product => product.category?.id === category.id && product.imageUrl)?.imageUrl;
}
