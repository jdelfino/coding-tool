/**
 * Tests for SessionView component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionView } from '../SessionView';

// Mock child components
jest.mock('../SessionControls', () => {
  return function MockSessionControls({
    sessionId,
    sectionName,
    joinCode,
    connectedStudentCount,
    onEndSession,
    onLeaveSession,
    onLoadProblem,
  }: any) {
    return (
      <div data-testid="session-controls">
        <span data-testid="session-id">{sessionId}</span>
        <span data-testid="section-name">{sectionName}</span>
        <span data-testid="join-code">{joinCode}</span>
        <span data-testid="student-count">{connectedStudentCount}</span>
        <button onClick={onEndSession} data-testid="end-session-btn">End Session</button>
        <button onClick={onLeaveSession} data-testid="leave-session-btn">Leave Session</button>
        <button onClick={onLoadProblem} data-testid="load-problem-btn">Load Problem</button>
      </div>
    );
  };
});

jest.mock('../SessionStudentPane', () => ({
  SessionStudentPane: function MockSessionStudentPane({
    students,
    onShowOnPublicView,
    onViewHistory,
  }: any) {
    return (
      <div data-testid="session-student-pane">
        <span data-testid="student-count-pane">{students.length}</span>
        <button
          onClick={() => onShowOnPublicView?.('student-1')}
          data-testid="feature-student-btn"
        >
          Feature Student
        </button>
        <button
          onClick={() => onViewHistory?.('student-1', 'Alice')}
          data-testid="view-history-btn"
        >
          View History
        </button>
      </div>
    );
  },
}));

jest.mock('../ProblemSetupPanel', () => ({
  ProblemSetupPanel: function MockProblemSetupPanel({
    onUpdateProblem,
    initialProblem,
  }: any) {
    return (
      <div data-testid="problem-setup-panel">
        <span data-testid="problem-title">{initialProblem?.title || 'No problem'}</span>
        <button
          onClick={() => onUpdateProblem({ title: 'Updated', description: '', starterCode: '' })}
          data-testid="update-problem-btn"
        >
          Update Problem
        </button>
      </div>
    );
  },
}));

jest.mock('../WalkthroughPanelWrapper', () => ({
  WalkthroughPanelWrapper: function MockWalkthroughPanelWrapper({
    sessionId,
    onFeatureStudent,
    studentCount,
  }: any) {
    return (
      <div data-testid="walkthrough-panel">
        <span data-testid="walkthrough-session-id">{sessionId}</span>
        <span data-testid="walkthrough-student-count">{studentCount}</span>
        <button
          onClick={() => onFeatureStudent('student-2')}
          data-testid="walkthrough-feature-btn"
        >
          Feature from Walkthrough
        </button>
      </div>
    );
  },
}));

jest.mock('../RevisionViewer', () => {
  return function MockRevisionViewer({ studentId, studentName, onClose }: any) {
    return (
      <div data-testid="revision-viewer">
        <span data-testid="revision-student-id">{studentId}</span>
        <span data-testid="revision-student-name">{studentName}</span>
        <button onClick={onClose} data-testid="close-revision-btn">Close</button>
      </div>
    );
  };
});

jest.mock('../ProblemLoader', () => {
  return function MockProblemLoader({ sessionId, onProblemLoaded, onClose }: any) {
    return (
      <div data-testid="problem-loader">
        <span data-testid="loader-session-id">{sessionId}</span>
        <button
          onClick={() => onProblemLoaded?.('problem-1')}
          data-testid="load-problem-confirm-btn"
        >
          Load
        </button>
        <button onClick={onClose} data-testid="close-loader-btn">Close</button>
      </div>
    );
  };
});

// Mock layout components
jest.mock('@/components/layout', () => ({
  RightPanelContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="right-panel-container">{children}</div>
  ),
}));

// Mock PanelContext
jest.mock('@/contexts/PanelContext', () => ({
  usePanelState: () => ({
    togglePanel: jest.fn(),
    isPanelExpanded: () => true,
  }),
}));

describe('SessionView', () => {
  const mockStudents = [
    { id: 'student-1', name: 'Alice', hasCode: true, executionSettings: {} },
    { id: 'student-2', name: 'Bob', hasCode: false, executionSettings: {} },
  ];

  const mockRealtimeStudents = [
    { id: 'student-1', name: 'Alice', code: 'print("Hello")' },
    { id: 'student-2', name: 'Bob', code: '' },
  ];

  const mockProblem = {
    id: 'problem-1',
    title: 'Test Problem',
    description: 'A test problem',
    starterCode: 'print("start")',
    namespaceId: 'namespace-1',
    authorId: 'author-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  const defaultProps = {
    sessionId: 'session-123',
    joinCode: 'ABC123',
    sessionContext: { sectionId: 'section-1', sectionName: 'Morning Section' },
    students: mockStudents,
    realtimeStudents: mockRealtimeStudents,
    sessionProblem: mockProblem,
    sessionExecutionSettings: { stdin: 'test input' },
    onEndSession: jest.fn().mockResolvedValue(undefined),
    onLeaveSession: jest.fn(),
    onUpdateProblem: jest.fn().mockResolvedValue(undefined),
    onFeatureStudent: jest.fn().mockResolvedValue(undefined),
    executeCode: jest.fn().mockResolvedValue({ success: true, output: '', error: '', executionTime: 100 }),
    onProblemLoaded: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the session view container', () => {
      render(<SessionView {...defaultProps} />);

      expect(screen.getByTestId('session-view')).toBeInTheDocument();
    });

    it('renders session controls with correct props', () => {
      render(<SessionView {...defaultProps} />);

      expect(screen.getByTestId('session-controls')).toBeInTheDocument();
      expect(screen.getByTestId('session-id')).toHaveTextContent('session-123');
      expect(screen.getByTestId('section-name')).toHaveTextContent('Morning Section');
      expect(screen.getByTestId('join-code')).toHaveTextContent('ABC123');
      expect(screen.getByTestId('student-count')).toHaveTextContent('2');
    });

    it('renders session student pane', () => {
      render(<SessionView {...defaultProps} />);

      expect(screen.getByTestId('session-student-pane')).toBeInTheDocument();
      expect(screen.getByTestId('student-count-pane')).toHaveTextContent('2');
    });

    it('renders problem setup panel', () => {
      render(<SessionView {...defaultProps} />);

      // Should be rendered twice - once in desktop right panel, once in mobile
      expect(screen.getAllByTestId('problem-setup-panel')).toHaveLength(2);
      expect(screen.getAllByTestId('problem-title')[0]).toHaveTextContent('Test Problem');
    });

    it('renders walkthrough panel', () => {
      render(<SessionView {...defaultProps} />);

      // Should be rendered twice - once in desktop, once in mobile
      expect(screen.getAllByTestId('walkthrough-panel')).toHaveLength(2);
      expect(screen.getAllByTestId('walkthrough-session-id')[0]).toHaveTextContent('session-123');
      expect(screen.getAllByTestId('walkthrough-student-count')[0]).toHaveTextContent('2');
    });

    it('renders right panel container for desktop', () => {
      render(<SessionView {...defaultProps} />);

      expect(screen.getByTestId('right-panel-container')).toBeInTheDocument();
    });
  });

  describe('session controls callbacks', () => {
    it('calls onEndSession when end session button is clicked', () => {
      render(<SessionView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('end-session-btn'));

      expect(defaultProps.onEndSession).toHaveBeenCalled();
    });

    it('calls onLeaveSession when leave session button is clicked', () => {
      render(<SessionView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('leave-session-btn'));

      expect(defaultProps.onLeaveSession).toHaveBeenCalled();
    });
  });

  describe('problem loader modal', () => {
    it('does not show problem loader initially', () => {
      render(<SessionView {...defaultProps} />);

      expect(screen.queryByTestId('problem-loader')).not.toBeInTheDocument();
    });

    it('shows problem loader when load problem button is clicked', () => {
      render(<SessionView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('load-problem-btn'));

      expect(screen.getByTestId('problem-loader')).toBeInTheDocument();
      expect(screen.getByTestId('loader-session-id')).toHaveTextContent('session-123');
    });

    it('closes problem loader and calls onProblemLoaded when problem is loaded', () => {
      render(<SessionView {...defaultProps} />);

      // Open the loader
      fireEvent.click(screen.getByTestId('load-problem-btn'));
      expect(screen.getByTestId('problem-loader')).toBeInTheDocument();

      // Load a problem
      fireEvent.click(screen.getByTestId('load-problem-confirm-btn'));

      // Should close and call callback
      expect(screen.queryByTestId('problem-loader')).not.toBeInTheDocument();
      expect(defaultProps.onProblemLoaded).toHaveBeenCalledWith('problem-1');
    });

    it('closes problem loader when close button is clicked', () => {
      render(<SessionView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('load-problem-btn'));
      expect(screen.getByTestId('problem-loader')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-loader-btn'));

      expect(screen.queryByTestId('problem-loader')).not.toBeInTheDocument();
    });
  });

  describe('revision viewer modal', () => {
    it('does not show revision viewer initially', () => {
      render(<SessionView {...defaultProps} />);

      expect(screen.queryByTestId('revision-viewer')).not.toBeInTheDocument();
    });

    it('shows revision viewer when view history is clicked', () => {
      render(<SessionView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('view-history-btn'));

      expect(screen.getByTestId('revision-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('revision-student-id')).toHaveTextContent('student-1');
      expect(screen.getByTestId('revision-student-name')).toHaveTextContent('Alice');
    });

    it('closes revision viewer when close button is clicked', () => {
      render(<SessionView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('view-history-btn'));
      expect(screen.getByTestId('revision-viewer')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-revision-btn'));

      expect(screen.queryByTestId('revision-viewer')).not.toBeInTheDocument();
    });
  });

  describe('feature student', () => {
    it('calls onFeatureStudent from student pane', () => {
      render(<SessionView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('feature-student-btn'));

      expect(defaultProps.onFeatureStudent).toHaveBeenCalledWith('student-1');
    });

    it('calls onFeatureStudent from walkthrough panel', () => {
      render(<SessionView {...defaultProps} />);

      // Get the first walkthrough feature button (desktop version)
      const featureButtons = screen.getAllByTestId('walkthrough-feature-btn');
      fireEvent.click(featureButtons[0]);

      expect(defaultProps.onFeatureStudent).toHaveBeenCalledWith('student-2');
    });
  });

  describe('problem updates', () => {
    it('calls onUpdateProblem when problem is updated', () => {
      render(<SessionView {...defaultProps} />);

      // Get the first update button (desktop version)
      const updateButtons = screen.getAllByTestId('update-problem-btn');
      fireEvent.click(updateButtons[0]);

      expect(defaultProps.onUpdateProblem).toHaveBeenCalledWith(
        { title: 'Updated', description: '', starterCode: '' }
      );
    });
  });

  describe('null/undefined handling', () => {
    it('handles null joinCode gracefully', () => {
      render(<SessionView {...defaultProps} joinCode={null} />);

      expect(screen.getByTestId('session-controls')).toBeInTheDocument();
    });

    it('handles null sessionContext gracefully', () => {
      render(<SessionView {...defaultProps} sessionContext={null} />);

      expect(screen.getByTestId('session-controls')).toBeInTheDocument();
    });

    it('handles null sessionProblem gracefully', () => {
      render(<SessionView {...defaultProps} sessionProblem={null} />);

      expect(screen.getAllByTestId('problem-title')[0]).toHaveTextContent('No problem');
    });
  });
});
