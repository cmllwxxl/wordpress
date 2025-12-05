import axios from 'axios';
import { Site } from './store';

// ... existing functions ...

async function proxyRequest(url: string, method: string, headers: any, data?: any, returnFullResponse = false, timeout?: number) {
    try {
        const response = await axios.post('/api/wp-proxy', {
            url,
            method,
            headers,
            data,
            timeout
        });
        // If returnFullResponse is true, return the whole object { data, headers, status }
        // Otherwise return just data for backward compatibility
        return returnFullResponse ? response.data : response.data.data;
    } catch (error: any) {
        // If the proxy itself fails (e.g. 500 Internal Server Error from Next.js)
        // or returns an error from the upstream WP
        const message = error.response?.data?.message || error.message || 'Request via proxy failed';
        throw new Error(message);
    }
}

export async function checkSiteHealth(url: string, type: 'wordpress' | 'custom' = 'wordpress') {
    try {
        // Ensure URL has protocol
        let baseURL = url;
        if (!baseURL.startsWith('http')) {
            baseURL = `https://${baseURL}`;
        }
        // Remove trailing slash
        baseURL = baseURL.replace(/\/$/, '');

        if (type === 'custom') {
            try {
                await axios.head(baseURL, { timeout: 15000 });
                return { status: 'online' as const };
            } catch (e) {
                // Try GET if HEAD fails
                try {
                    await axios.get(baseURL, { timeout: 15000 });
                    return { status: 'online' as const };
                } catch (e2) {
                    return { status: 'offline' as const };
                }
            }
        }

        const response = await axios.get(`${baseURL}/wp-json/`, {
            timeout: 15000,
        });

        if (response.status === 200 && response.data) {
            return {
                status: 'online' as const,
                name: response.data.name,
                description: response.data.description,
                version: response.data.namespaces?.includes('wp/v2') ? 'WP API Active' : 'Unknown',
            };
        }
        return { status: 'offline' as const };
    } catch (error) {
        console.error('Error checking site:', error);
        return { status: 'offline' as const };
    }
}

export async function getSiteStats(url: string) {
    try {
        const [postsResponse, commentsResponse] = await Promise.all([
            axios.head(`${url}/wp-json/wp/v2/posts?per_page=1`, { timeout: 15000 }),
            axios.head(`${url}/wp-json/wp/v2/comments?per_page=1`, { timeout: 15000 })
        ]);

        const postCount = parseInt(postsResponse.headers['x-wp-total'] || '0', 10);
        const commentCount = parseInt(commentsResponse.headers['x-wp-total'] || '0', 10);

        return {
            postCount: isNaN(postCount) ? 0 : postCount,
            commentCount: isNaN(commentCount) ? 0 : commentCount
        };
    } catch (error) {
        console.error('Error fetching site stats:', error);
        return { postCount: 0, commentCount: 0 };
    }
}

export async function getRecentPosts(url: string) {
    try {
        const response = await axios.get(`${url}/wp-json/wp/v2/posts?per_page=5&_embed`);
        return response.data;
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

export async function getPostCountsByDate(url: string, days = 30) {
    try {
        const date = new Date();
        date.setDate(date.getDate() - days);
        const after = date.toISOString();

        const response = await axios.get(`${url}/wp-json/wp/v2/posts?after=${after}&per_page=100&_fields=date`);

        if (!Array.isArray(response.data)) return {};

        const counts: Record<string, number> = {};
        response.data.forEach((post: { date: string }) => {
            const dateStr = post.date.split('T')[0];
            counts[dateStr] = (counts[dateStr] || 0) + 1;
        });

        return counts;
    } catch (error) {
        console.error('Error fetching post counts by date:', error);
        return {};
    }
}

export async function sendWebhookNotification(webhookUrl: string, siteName: string, siteUrl: string, status: string) {
    if (!webhookUrl) return;

    try {
        await axios.post(webhookUrl, {
            msgtype: "markdown",
            markdown: {
                content: `### ⚠️ 站点状态异常通知
> **站点名称**: ${siteName}
> **站点地址**: ${siteUrl}
> **当前状态**: <font color="warning">${status.toUpperCase()}</font>
> **检测时间**: ${new Date().toLocaleString()}
> 
> 请尽快检查您的网站服务。`
            }
        });
    } catch (error) {
        console.error('Failed to send webhook notification:', error);
    }
}

export async function sendEmailNotification(email: string, siteName: string, siteUrl: string, status: string) {
    if (!email) return;

    try {
        await axios.post('/api/send-email', {
            to: email,
            siteName,
            siteUrl,
            status
        });
    } catch (error) {
        console.error('Failed to send email notification:', error);
    }
}

function getAuthHeader(site: Site) {
    if (!site.username || !site.appPassword) return {};
    const token = btoa(`${site.username}:${site.appPassword}`);
    return { Authorization: `Basic ${token}` };
}

function getAuthHeaderWithCreds(username: string, appPassword: string) {
    const token = btoa(`${username}:${appPassword}`);
    return { Authorization: `Basic ${token}` };
}

export async function verifyCredentials(site: Site, username: string, appPassword: string) {
    try {
        await proxyRequest(
            `${site.url}/wp-json/wp/v2/users/me`,
            'GET',
            getAuthHeaderWithCreds(username, appPassword)
        );
        return true;
    } catch (error: any) {
        console.error('Credential verification failed:', error);
        if (error.message.includes('401') || error.message.includes('403')) {
            throw new Error('用户名或应用程序密码无效');
        }
        throw new Error(`验证失败: ${error.message}`);
    }
}

// Plugin Management API

interface Plugin {
    plugin: string;
    name: string;
    status: 'active' | 'inactive';
    version: string;
    description: string;
}

export async function getPlugins(site: Site) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/plugins`,
            'GET',
            getAuthHeader(site)
        );
        return data as Plugin[];
    } catch (error: any) {
        console.error('Error fetching plugins:', error);
        throw new Error(error.message || 'Failed to fetch plugins');
    }
}

export async function updatePlugin(site: Site, plugin: string, status: 'active' | 'inactive') {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/plugins/${plugin}`,
            'POST',
            getAuthHeader(site),
            { status }
        );
        return data;
    } catch (error: any) {
        console.error('Error updating plugin:', error);
        throw new Error(error.message || 'Failed to update plugin');
    }
}

export async function deletePlugin(site: Site, plugin: string) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/plugins/${plugin}`,
            'DELETE',
            getAuthHeader(site)
        );
        return data;
    } catch (error: any) {
        console.error('Error deleting plugin:', error);
        throw new Error(error.message || 'Failed to delete plugin');
    }
}

export async function installPlugin(site: Site, slug: string) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/plugins`,
            'POST',
            getAuthHeader(site),
            { slug, status: 'active' },
            false,
            60000 // 60s timeout for installation
        );
        return data;
    } catch (error: any) {
        console.error('Error installing plugin:', error);
        if (error.response?.status === 500 || error.message.includes('500')) {
            try {
                throw new Error('Plugin might be installed but activation failed. Please check manually.');
            } catch (e) {
                throw new Error(error.response?.data?.message || 'Failed to install plugin');
            }
        }
        // Provide more helpful error message
        const msg = error.response?.data?.message || error.message;
        if (msg.includes('filesystem_credentials')) {
            throw new Error('站点需要 FTP 凭证才能安装插件，目前不支持。请检查服务器文件权限。');
        }
        throw new Error(msg || 'Failed to install plugin');
    }
}

// Theme Management API

interface Theme {
    theme: string; // The stylesheet handle e.g. "twentytwentyfour"
    name: string;
    status: 'active' | 'inactive';
    version: string;
    description: string;
    author: string;
    screenshot?: string;
}

export async function getThemes(site: Site) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/themes`,
            'GET',
            getAuthHeader(site)
        );
        return data as Theme[];
    } catch (error: any) {
        console.error('Error fetching themes:', error);
        throw new Error(error.message || 'Failed to fetch themes');
    }
}

export async function activateTheme(site: Site, theme: string) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/themes/${theme}`,
            'POST',
            getAuthHeader(site),
            { status: 'active' }
        );
        return data;
    } catch (error: any) {
        console.error('Error activating theme:', error);
        throw new Error(error.message || 'Failed to activate theme');
    }
}

// Comment Management API

export interface Comment {
    id: number;
    post: number;
    parent: number;
    author: number;
    author_name: string;
    author_email: string;
    author_url: string;
    date: string;
    content: { rendered: string };
    status: 'approved' | 'hold' | 'spam' | 'trash';
    author_avatar_urls?: { [key: string]: string };
}

export async function getComments(site: Site, status?: string, per_page = 20, page = 1) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        let query = `?per_page=${per_page}&page=${page}`;
        if (status) {
            query += `&status=${status}`;
        }

        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/comments${query}`,
            'GET',
            getAuthHeader(site)
        );
        return data;
    } catch (error: any) {
        console.error('Error fetching comments:', error);
        throw new Error(error.message || 'Failed to fetch comments');
    }
}

export async function getCommentCounts(site: Site) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const statuses = ['all', 'hold', 'approve', 'spam', 'trash'];

        const requests = statuses.map(status => {
            let query = '?per_page=1';
            if (status !== 'all') {
                query += `&status=${status}`;
            }
            return proxyRequest(
                `${site.url}/wp-json/wp/v2/comments${query}`,
                'GET',
                getAuthHeader(site),
                undefined,
                true
            ).then((response: any) => {
                return parseInt(response.headers['x-wp-total'] || '0', 10);
            });
        });

        const counts = await Promise.all(requests);
        return {
            all: counts[0],
            hold: counts[1],
            approved: counts[2],
            spam: counts[3],
            trash: counts[4]
        };
    } catch (error) {
        console.error('Error fetching comment counts:', error);
        return { all: 0, hold: 0, approved: 0, spam: 0, trash: 0 };
    }
}

export async function updateComment(site: Site, id: number, status: string) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/comments/${id}`,
            'POST',
            getAuthHeader(site),
            { status }
        );
        return data;
    } catch (error: any) {
        console.error('Error updating comment:', error);
        throw new Error(error.message || 'Failed to update comment');
    }
}

export async function deleteComment(site: Site, id: number, force = false) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const query = force ? '?force=true' : '';
        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/comments/${id}${query}`,
            'DELETE',
            getAuthHeader(site)
        );
        return data;
    } catch (error: any) {
        console.error('Error deleting comment:', error);
        throw new Error(error.message || 'Failed to delete comment');
    }
}

// Post Management API

export interface Post {
    id: number;
    date: string;
    date_gmt: string;
    guid: { rendered: string };
    modified: string;
    modified_gmt: string;
    slug: string;
    status: 'publish' | 'future' | 'draft' | 'pending' | 'private' | 'trash';
    type: string;
    link: string;
    title: { rendered: string };
    content: { rendered: string };
    excerpt: { rendered: string };
    author: number;
    featured_media: number;
    comment_status: string;
    ping_status: string;
    sticky: boolean;
    template: string;
    format: string;
    categories: number[];
    tags: number[];
    _embedded?: any;
}

export async function getPosts(site: Site, status?: string, per_page = 20, page = 1) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        let query = `?per_page=${per_page}&page=${page}&_embed`;

        // WP API filtering
        if (status && status !== 'all') {
            query += `&status=${status}`;
        } else if (status === 'all') {
            // Explicitly include statuses that are usually hidden
            query += `&status=publish,future,draft,pending,private`;
        }

        const data = await proxyRequest(
            `${site.url}/wp-json/wp/v2/posts${query}`,
            'GET',
            getAuthHeader(site)
        );
        return data;
    } catch (error: any) {
        console.error('Error fetching posts:', error);
        throw new Error(error.message || 'Failed to fetch posts');
    }
}

export async function getPostCounts(site: Site) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        // Statuses to check
        const statuses = ['publish', 'draft', 'pending', 'private', 'trash'];

        const requests = statuses.map(status => {
            return proxyRequest(
                `${site.url}/wp-json/wp/v2/posts?per_page=1&status=${status}`,
                'GET',
                getAuthHeader(site),
                undefined,
                true
            ).then((response: any) => {
                return parseInt(response.headers['x-wp-total'] || '0', 10);
            });
        });

        const counts = await Promise.all(requests);
        const allCount = counts[0] + counts[1] + counts[2] + counts[3]; // Sum except trash for 'All' view typically

        return {
            all: allCount,
            publish: counts[0],
            draft: counts[1],
            pending: counts[2],
            private: counts[3],
            trash: counts[4]
        };
    } catch (error) {
        console.error('Error fetching post counts:', error);
        return { all: 0, publish: 0, draft: 0, pending: 0, private: 0, trash: 0 };
    }
}

export async function updatePost(site: Site, id: number, data: any) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const response = await proxyRequest(
            `${site.url}/wp-json/wp/v2/posts/${id}`,
            'POST',
            getAuthHeader(site),
            data
        );
        return response;
    } catch (error: any) {
        console.error('Error updating post:', error);
        throw new Error(error.message || 'Failed to update post');
    }
}

export async function deletePost(site: Site, id: number, force = false) {
    if (!site.username || !site.appPassword) throw new Error('Authentication required');

    try {
        const query = force ? '?force=true' : '';
        const response = await proxyRequest(
            `${site.url}/wp-json/wp/v2/posts/${id}${query}`,
            'DELETE',
            getAuthHeader(site)
        );
        return response;
    } catch (error: any) {
        console.error('Error deleting post:', error);
        throw new Error(error.message || 'Failed to delete post');
    }
}
