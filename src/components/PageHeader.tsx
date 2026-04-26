import { useLocation } from 'react-router-dom';
import { C } from '../theme';

const PageHeader = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const getPageDetails = () => {
    if (pathname === '/dashboard' || pathname === '/') {
        return {
            title: 'Dashboard',
            description: 'Overview of your team health and recent insights.'
        };
    }


    if (pathname.startsWith('/teams')) {
      return {
          title: 'Team',
          description: 'View and manage your organisation members.'
      };
    }

    if (pathname.startsWith('/meetings')) {
      return {
        title: 'Meetings',
        description: 'Start live sessions or upload files to analyse.'
      };
    }

    if (pathname.startsWith('/files') || pathname.startsWith('/transcripts')) {
      return {
        title: 'Files',
        description: 'Unified library of live meetings and uploaded documents.'
      };
    }

    if (pathname.startsWith('/calendar')) {
        return {
            title: 'Calendar',
            description: 'Manage your schedules and events.'
        };
    }

    if (pathname.startsWith('/live-recordings')) {
      return {
        title: 'Meetings',
        description: 'Start live sessions or upload files to analyse.'
      };
    }

    // 4. Coach Routes
    if (pathname.startsWith('/coach')) {
        return {
            title: 'AI Coach',
            description: 'Your personalized growth and development assistant.'
        };
    }

    // Fallback
    return {
        title: 'Dashboard',
        description: 'Overview of your personal insights.'
    };
  };

  const { title, description } = getPageDetails();

  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="text-lg font-semibold" style={{ color: C.text }}>
        {title}
      </h1>
      <p className="text-xs" style={{ color: C.textDim }}>
        {description}
      </p>
    </div>
  );
};

export default PageHeader;