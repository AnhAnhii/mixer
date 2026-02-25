/**
 * Navigation hook using React Router.
 * Drop-in replacement for `setView(page)` calls in components.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import type { Page } from '../types';
import { getPathForPage, getPageForPath } from './routes';

export function useAppNavigation() {
    const navigate = useNavigate();
    const location = useLocation();

    const currentPage: Page = useMemo(
        () => getPageForPath(location.pathname),
        [location.pathname],
    );

    const navigateTo = useCallback(
        (page: Page) => {
            const path = getPathForPage(page);
            navigate(path);
        },
        [navigate],
    );

    const goBack = useCallback(() => navigate(-1), [navigate]);

    return { currentPage, navigateTo, goBack, pathname: location.pathname };
}
