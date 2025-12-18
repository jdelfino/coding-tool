'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <main style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ 
        maxWidth: '600px',
        textAlign: 'center',
        backgroundColor: 'white',
        padding: '3rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          fontSize: '3rem',
          marginBottom: '1rem',
          color: '#0070f3'
        }}>
          Live Coding Classroom
        </h1>
        
        <p style={{ 
          fontSize: '1.2rem',
          color: '#666',
          marginBottom: '3rem'
        }}>
          A real-time coding tool for classroom instruction. 
          Instructors can create sessions and monitor student progress. 
          Students can write and execute code in their browser.
        </p>

        <div style={{ 
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => router.push('/instructor')}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              minWidth: '200px',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0051cc'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0070f3'}
          >
            I'm an Instructor
          </button>

          <button
            onClick={() => router.push('/student')}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              minWidth: '200px',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            I'm a Student
          </button>
        </div>

        <div style={{ 
          marginTop: '3rem',
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '0.9rem',
          color: '#666'
        }}>
          <h3 style={{ marginTop: 0 }}>Features:</h3>
          <ul style={{ textAlign: 'left', lineHeight: '1.8' }}>
            <li>Create coding sessions with unique join codes</li>
            <li>Real-time code synchronization</li>
            <li>Python code execution with instant feedback</li>
            <li>View and run student code anonymously</li>
            <li>No installation required - works in any browser</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
