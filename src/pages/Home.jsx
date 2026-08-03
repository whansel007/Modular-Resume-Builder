import { Link } from 'react-router-dom';
import styles from './Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Modular Resume Builder</h1>
        <p className={styles.subtitle}>Build your resume with reusable, modular blocks.</p>
        <div className={styles.actions}>
          <Link to="/login" className={styles.primaryBtn}>
            Start Building
          </Link>
        </div>
        <div className={styles.links}>
          <Link to="/login">Login</Link>
          <span className={styles.sep}>·</span>
          <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
