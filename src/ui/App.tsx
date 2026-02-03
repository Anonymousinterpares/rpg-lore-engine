import React from 'react';
import styles from './App.module.css';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainViewport from './components/layout/MainViewport';
import RightPanel from './components/layout/RightPanel';

const App: React.FC = () => {
    return (
        <div className={styles.appShell}>
            <Header />
            <div className={styles.mainContent}>
                <Sidebar className={styles.sidebar} />
                <MainViewport className={styles.viewport} />
                <RightPanel className={styles.rightPanel} />
            </div>
        </div>
    );
};

export default App;
