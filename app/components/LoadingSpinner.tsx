'use client';
import styles from './LoadingSpinner.module.css';

interface Props {
  message?: string;
}

export default function LoadingSpinner({ message = 'Loading...' }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.spinner} />
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
}
