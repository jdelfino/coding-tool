import { renderHook, act } from '@testing-library/react';
import { useDebugger } from '../useDebugger';
import { ExecutionTrace } from '@/server/types';

describe('useDebugger', () => {
  let sendMessage: jest.Mock;

  beforeEach(() => {
    sendMessage = jest.fn();
  });

  const mockTrace: ExecutionTrace = {
    steps: [
      {
        line: 1,
        event: 'line',
        locals: {},
        globals: {},
        callStack: [{ functionName: '<module>', filename: '<string>', line: 1 }],
        stdout: ''
      },
      {
        line: 2,
        event: 'line',
        locals: { x: 5 },
        globals: {},
        callStack: [{ functionName: '<module>', filename: '<string>', line: 2 }],
        stdout: ''
      },
      {
        line: 3,
        event: 'line',
        locals: { x: 5, y: 10 },
        globals: {},
        callStack: [{ functionName: '<module>', filename: '<string>', line: 3 }],
        stdout: ''
      }
    ],
    totalSteps: 3,
    exitCode: 0,
    truncated: false
  };

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    expect(result.current.trace).toBeNull();
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('requests trace with correct payload', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.requestTrace('print("hello")', 'input', 1000);
    });

    expect(sendMessage).toHaveBeenCalledWith('TRACE_REQUEST', {
      code: 'print("hello")',
      stdin: 'input',
      maxSteps: 1000
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('sets trace and resets step to 0', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
    });

    expect(result.current.trace).toEqual(mockTrace);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('steps forward correctly', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
    });

    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentStep).toBe(1);

    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentStep).toBe(2);

    // Should not go beyond last step
    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentStep).toBe(2);
  });

  it('steps backward correctly', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
      result.current.jumpToStep(2);
    });

    act(() => {
      result.current.stepBackward();
    });

    expect(result.current.currentStep).toBe(1);

    act(() => {
      result.current.stepBackward();
    });

    expect(result.current.currentStep).toBe(0);

    // Should not go below 0
    act(() => {
      result.current.stepBackward();
    });

    expect(result.current.currentStep).toBe(0);
  });

  it('jumps to specific step', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
    });

    act(() => {
      result.current.jumpToStep(2);
    });

    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.jumpToStep(0);
    });

    expect(result.current.currentStep).toBe(0);
  });

  it('jumps to first and last steps', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
      result.current.jumpToStep(1);
    });

    act(() => {
      result.current.jumpToLast();
    });

    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.jumpToFirst();
    });

    expect(result.current.currentStep).toBe(0);
  });

  it('resets state correctly', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
      result.current.stepForward();
    });

    expect(result.current.currentStep).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.trace).toBeNull();
    expect(result.current.currentStep).toBe(0);
  });

  it('gets current step data', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
      result.current.jumpToStep(1);
    });

    const currentStep = result.current.getCurrentStep();
    expect(currentStep?.line).toBe(2);
    expect(currentStep?.locals).toEqual({ x: 5 });
  });

  it('gets current locals and globals', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
      result.current.jumpToStep(2);
    });

    expect(result.current.getCurrentLocals()).toEqual({ x: 5, y: 10 });
    expect(result.current.getCurrentGlobals()).toEqual({});
  });

  it('gets current call stack', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    act(() => {
      result.current.setTrace(mockTrace);
    });

    const callStack = result.current.getCurrentCallStack();
    expect(callStack).toHaveLength(1);
    expect(callStack[0].functionName).toBe('<module>');
  });

  it('provides correct navigation flags', () => {
    const { result } = renderHook(() => useDebugger(sendMessage));

    // No trace
    expect(result.current.canStepForward).toBe(false);
    expect(result.current.canStepBackward).toBe(false);

    act(() => {
      result.current.setTrace(mockTrace);
    });

    // At first step
    expect(result.current.canStepForward).toBe(true);
    expect(result.current.canStepBackward).toBe(false);

    act(() => {
      result.current.jumpToStep(1);
    });

    // In middle
    expect(result.current.canStepForward).toBe(true);
    expect(result.current.canStepBackward).toBe(true);

    act(() => {
      result.current.jumpToLast();
    });

    // At last step
    expect(result.current.canStepForward).toBe(false);
    expect(result.current.canStepBackward).toBe(true);
  });
});
