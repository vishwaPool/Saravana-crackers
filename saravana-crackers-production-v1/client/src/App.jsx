import {Routes,Route,Navigate} from "react-router-dom";
import Store from "./components/Store";
import AdminLayout from "./components/AdminLayout";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Track from "./pages/Track";
import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import ProductsAdmin from "./pages/admin/ProductsAdmin";
import CategoriesAdmin from "./pages/admin/CategoriesAdmin";
import OrdersAdmin from "./pages/admin/OrdersAdmin";
import OffersAdmin from "./pages/admin/OffersAdmin";
import CustomersAdmin from "./pages/admin/CustomersAdmin";
import SuppliersAdmin from "./pages/admin/SuppliersAdmin";
import PurchasesAdmin from "./pages/admin/PurchasesAdmin";
import StockAdmin from "./pages/admin/StockAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import AuditAdmin from "./pages/admin/AuditAdmin";

export default function App(){
  return <Routes>
    <Route element={<Store/>}>
      <Route path="/" element={<Home/>}/>
      <Route path="/products" element={<Products/>}/>
      <Route path="/products/:category" element={<Products/>}/>
      <Route path="/cart" element={<Cart/>}/>
      <Route path="/checkout" element={<Checkout/>}/>
      <Route path="/track-order" element={<Track/>}/>
    </Route>
    <Route path="/admin/login" element={<Login/>}/>
    <Route path="/admin" element={<AdminLayout/>}>
      <Route index element={<Navigate to="dashboard" replace/>}/>
      <Route path="dashboard" element={<Dashboard/>}/>
      <Route path="products" element={<ProductsAdmin/>}/>
      <Route path="categories" element={<CategoriesAdmin/>}/>
      <Route path="orders" element={<OrdersAdmin/>}/>
      <Route path="offers" element={<OffersAdmin/>}/>
      <Route path="customers" element={<CustomersAdmin/>}/>
      <Route path="suppliers" element={<SuppliersAdmin/>}/>
      <Route path="purchases" element={<PurchasesAdmin/>}/>
      <Route path="stock" element={<StockAdmin/>}/>
      <Route path="settings" element={<SettingsAdmin/>}/>
      <Route path="audit" element={<AuditAdmin/>}/>
    </Route>
  </Routes>
}
