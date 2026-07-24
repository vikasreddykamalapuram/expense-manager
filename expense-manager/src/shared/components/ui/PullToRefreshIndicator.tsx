/**
 * Visual indicator for pull-to-refresh gestures. Renders a translating
 * spinner slot that follows the finger drag. Pair with `usePullToRefresh`:
 *
 *   const pull = usePullToRefresh({ onRefresh: reload });
 *   return (
 *     <div ref={pull.containerRef} className="overflow-y-auto h-full">
 *       <PullToRefreshIndicator {...pull} />
 *       ...content...
 *     </div>
 *   );
 */
import { RefreshCw } from 'lucide-react';
import { classNames } from '../../utils/helpers';

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  isReadyToTrigger: boolean;
}

export function PullToRefreshIndicator({ pullDistance, isRefreshing, isReadyToTrigger }: Props) {
  const visible = pullDistance > 0 || isRefreshing;
  const height = isRefreshing ? 56 : pullDistance;
  return (
    <div
      aria-hidden={!visible}
      className={classNames(
        'flex items-center justify-center overflow-hidden text-primary-500 transition-[height]',
        isRefreshing ? 'duration-200' : 'duration-0',
      )}
      style={{ height: `${height}px` }}
    >
      {visible && (
        <RefreshCw
          size={20}
          className={classNames(
            isRefreshing ? 'animate-spin' : '',
            !isRefreshing && isReadyToTrigger ? 'rotate-180 transition-transform' : 'transition-transform',
          )}
        />
      )}
    </div>
  );
}
