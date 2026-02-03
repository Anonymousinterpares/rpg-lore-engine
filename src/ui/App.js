import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './App.module.css';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainViewport from './components/layout/MainViewport';
import RightPanel from './components/layout/RightPanel';
const App = () => {
    return (_jsxs("div", { className: styles.appShell, children: [_jsx(Header, {}), _jsxs("div", { className: styles.mainContent, children: [_jsx(Sidebar, { className: styles.sidebar }), _jsx(MainViewport, { className: styles.viewport }), _jsx(RightPanel, { className: styles.rightPanel })] })] }));
};
export default App;
