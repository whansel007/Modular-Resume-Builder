import { Link } from 'react-router-dom';
import styles from './Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <div className={styles.sheet}>
        <p className={styles.eyebrow}>Pressroom · Modular Resume Builder</p>

        <h1 className={styles.title}>
          Set your resume
          <br />
          in blocks.
        </h1>

        <p className={styles.subtitle}>
          Compose your resume from reusable blocks, then re-set it for every
          job listing — without rewriting a single word.
        </p>

        <ul className={styles.legend}>
          <li>
            <span className={styles.swatch} data-block-type="summary" />
            Summary
          </li>
          <li>
            <span className={styles.swatch} data-block-type="experience" />
            Experience
          </li>
          <li>
            <span className={styles.swatch} data-block-type="education" />
            Education
          </li>
          <li>
            <span className={styles.swatch} data-block-type="skills" />
            Skills
          </li>
        </ul>

        <div className={styles.actions}>
          <Link to="/register" className={styles.primaryBtn}>
            Start building
          </Link>
          <Link to="/login" className={styles.ghostBtn}>
            I have an account
          </Link>
        </div>

        <p className={styles.footer}>
          Drag · drop · export PDF — one block at a time.
        </p>
      </div>
    </div>
  );
}
