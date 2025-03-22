// src/models/EASAccount.js
import Account from './Account';
import { UJNAPI } from '../constants/api';
import store from '../utils/store';
import cryptoUtils from '../utils/cryptoUtils';
import { ElMessage } from 'element-plus';
import ipc from '../utils/ipc';
import CookieJar from './CookieJar';

/**
 * 教务系统账号类
 */
class EASAccount extends Account {
    /**
     * 私有构造函数，使用 getInstance 获取实例
     */
    constructor() {
        super(
            UJNAPI.EA_HOSTS[store.getInt('EA_HOST', 0)],
            'EAS_ACCOUNT',
            'EAS_PASSWORD',
            'http',
            'eaCookie'
        );

        // 入学年份
        this._entranceTime = store.getInt('ENTRANCE_TIME', -1);

        // 使用CookieJar管理Cookie
        this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName);
    }

    /**
     * 单例实例
     */
    static instance = null;

    /**
     * 获取单例实例
     * @returns {EASAccount} 实例
     */
    static getInstance() {
        if (EASAccount.useVpn) {
            // 在实际应用中实现 VpnEASAccount
            // return VpnEASAccount.getInstance()
            console.log('VPN模式暂未实现');

            if (!EASAccount.instance) {
                EASAccount.instance = new EASAccount();
            }

            return EASAccount.instance;
        }

        if (!EASAccount.instance) {
            EASAccount.instance = new EASAccount();
        }

        return EASAccount.instance;
    }

    /**
     * 是否使用VPN
     */
    static useVpn = store.getBoolean('EA_USE_VPN', false);

    /**
     * 切换教务节点
     * @param {number} index 节点索引
     */
    changeHost(index) {
        if (index >= UJNAPI.EA_HOSTS.length) return;

        this.isLogin = false;
        this.cookieJar.clearCookies();
        this.host = UJNAPI.EA_HOSTS[index];
        store.edit(editor => editor.putInt('EA_HOST', index));
    }

    /**
     * 获取入学年份
     * @returns {number} 入学年份
     */
    get entranceTime() {
        return this._entranceTime;
    }

    /**
     * 设置入学年份
     * @param {number} value 入学年份
     */
    set entranceTime(value) {
        this._entranceTime = value;
        store.edit(editor => editor.putInt('ENTRANCE_TIME', value));
    }

    /**
     * 获取完整URL
     * @param {string} path 路径
     * @returns {string} 完整URL
     */
    getFullUrl(path) {
        return `${this.scheme}://${this.host}/${path}`;
    }

    /**
     * 检查登录状态
     * @returns {Promise<boolean>} 是否已登录
     */
    async absCheckLogin() {
        try {
            // 使用 ipc 发送请求
            const result = await ipc.easGet(this.getFullUrl('jwglxt/xtgl/index_initMenu.html'), {
                cookies: await store.getStringSet(this.cookieName)
            });

            return result.success && result.status === 200;
        } catch (error) {
            console.error('检查登录状态失败', error);
            return false;
        }
    }

    /**
     * 登录
     * @param {string} account 账号
     * @param {string} password 密码
     * @returns {Promise<boolean>} 登录是否成功
     */
    async absLogin(account, password) {
        try {
            // 清空之前的Cookie
            this.cookieJar.clearCookies();

            // 获取登录页面
            const loginPageResult = await ipc.easGet(this.getFullUrl(UJNAPI.EA_LOGIN));

            if (!loginPageResult.success) {
                throw new Error(loginPageResult.error || '无法获取登录页面');
            }

            // 提取 csrftoken
            const loginPageHtml = loginPageResult.data;
            const csrfTokenMatch = loginPageHtml.match(/<input[^>]+name="csrftoken"[^>]+value="([^"]+)"/);
            if (!csrfTokenMatch) {
                throw new Error('无法获取 csrfToken');
            }
            const csrfToken = csrfTokenMatch[1];

            // 获取 RSA 公钥
            const publicKeyResult = await ipc.easGet(this.getFullUrl(UJNAPI.EA_LOGIN_PUBLIC_KEY));

            if (!publicKeyResult.success) {
                throw new Error(publicKeyResult.error || '无法获取 RSA 公钥');
            }

            const publicKeyData = JSON.parse(publicKeyResult.data);
            if (!publicKeyData.modulus) {
                throw new Error('无法获取 publicKey');
            }

            // 使用 RSA 加密密码
            const rsaPassword = cryptoUtils.encryptPassword(password, publicKeyData.modulus, publicKeyData.exponent);
            if (!rsaPassword) {
                throw new Error('RSA 加密出错');
            }

            // 执行登录
            const loginResult = await ipc.easPost(this.getFullUrl(UJNAPI.EA_LOGIN), {
                csrftoken: csrfToken,
                yhm: account,
                mm: rsaPassword
            });

            if (loginResult.success) {
                // 保存 Cookie
                if (loginResult.cookies) {
                    await store.putStringSet(this.cookieName, new Set(loginResult.cookies));
                }

                // 自动提取学生信息
                this.fetchStudentInfo(account);

                return true;
            }

            return false;
        } catch (error) {
            console.error('登录失败', error);
            return false;
        }
    }

    /**
     * 获取学生信息
     * @param {string} account 学号
     */
    async fetchStudentInfo(account) {
        try {
            // 获取学生信息
            const response = await ipc.easGet(
                this.getFullUrl('jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801'),
                { cookies: await store.getStringSet(this.cookieName) }
            );

            // 处理响应...
            console.log('获取学生信息成功');

            // 提取学号中的入学年份信息
            if (account && account.length >= 4) {
                const yearPrefix = account.substring(0, 4);
                const year = parseInt(yearPrefix, 10);

                if (!isNaN(year) && year >= 1990 && year <= new Date().getFullYear()) {
                    this.entranceTime = year;
                }
            }
        } catch (error) {
            console.error('获取学生信息失败', error);
        }
    }

    /**
     * 获取当前年级
     * @returns {number} 当前年级
     */
    getCurrentGrade() {
        const calendar = new Date();
        const y = calendar.getFullYear();

        if (y < this.entranceTime) {
            return 0;
        } else {
            // 计算当前年级，考虑学期
            const month = calendar.getMonth();
            return Math.min(
                (y - this.entranceTime) * 2 - (month < 7 ? 1 : 0),
                7 // 假设最多8个学期
            );
        }
    }

    /**
     * 查询成绩
     * @param {number} index 学期索引
     * @param {string} xnm 学年代码 20xx
     * @param {string} xqm 学期代码 12 | 3
     * @returns {Promise<Array>} 成绩列表
     */
    async queryMark(index, xnm, xqm) {
        try {
            // 查询成绩列表
            const markResponse = await ipc.easPost(
                this.getFullUrl(UJNAPI.GET_MARK),
                {
                    xnm: xnm,
                    xqm: xqm,
                    'queryModel.showCount': '999'
                },
                { cookies: await store.getStringSet(this.cookieName) }
            );

            if (!markResponse.success) {
                throw new Error(markResponse.error || '查询成绩失败');
            }

            // 解析成绩数据
            const markData = JSON.parse(markResponse.data);
            const markMap = new Map();

            if (markData && markData.items) {
                for (const item of markData.items) {
                    const name = item.kcmc;
                    if (!markMap.has(name)) {
                        markMap.set(name, {
                            kchId: item.kch_id,
                            name: name.trim(),
                            type: item.ksxz || '正常考试',
                            credit: item.xf,
                            mark: parseFloat(item.cj || '0'),
                            time: item.tjsj ? new Date(item.tjsj) : new Date(),
                            items: [],
                            index: index,
                            isNew: 1
                        });
                    }
                }
            }

            // 查询成绩详情
            const markDetailResponse = await ipc.easPost(
                this.getFullUrl(UJNAPI.GET_MARK_DETAIL),
                {
                    xnm: xnm,
                    xqm: xqm,
                    'queryModel.showCount': '999'
                },
                { cookies: await store.getStringSet(this.cookieName) }
            );

            if (!markDetailResponse.success) {
                throw new Error(markDetailResponse.error || '查询成绩详情失败');
            }

            // 解析成绩详情数据
            const markDetailData = JSON.parse(markDetailResponse.data);

            if (markDetailData && markDetailData.items) {
                for (const item of markDetailData.items) {
                    const name = item.kcmc;
                    let mark = markMap.get(name);

                    if (!mark) {
                        mark = {
                            kchId: item.kch_id,
                            name: name.trim(),
                            type: item.ksxz || '正常考试',
                            credit: item.xf,
                            mark: 0,
                            time: item.tjsj ? new Date(item.tjsj) : new Date(),
                            items: [],
                            index: index,
                            isNew: 1
                        };
                        markMap.set(name, mark);
                    }

                    // 添加成绩项
                    if (item.xmblmc) {
                        if (item.xmblmc === '总评' && mark.mark === 0 && item.xmcj) {
                            mark.mark = parseFloat(item.xmcj || '0');

                            // 计算绩点
                            if (mark.mark < 60) {
                                mark.gpa = '0';
                            } else if (mark.type === '正常考试') {
                                mark.gpa = (mark.mark >= 95) ? '5.0' : ((5.0 - (95 - mark.mark) / 10).toFixed(2)).toString();
                            } else {
                                mark.gpa = '1';
                            }
                        } else {
                            mark.items.push({
                                name: item.xmblmc,
                                mark: item.xmcj || ''
                            });
                        }
                    }
                }
            }

            return Array.from(markMap.values());
        } catch (error) {
            console.error('查询成绩失败', error);
            return [];
        }
    }

    /**
     * 查询教务通知
     * @param {number} page 页码
     * @param {number} pageSize 每页数量
     * @returns {Promise<Array>} 通知列表
     */
    async queryNotice(page = 1, pageSize = 1) {
        try {
            const response = await ipc.easPost(
                this.getFullUrl(UJNAPI.EA_SYSTEM_NOTICE),
                {
                    'queryModel.showCount': pageSize.toString(),
                    'queryModel.currentPage': page.toString(),
                    'queryModel.sortName': 'cjsj',
                    'queryModel.sortOrder': 'desc'
                },
                { cookies: await store.getStringSet(this.cookieName) }
            );

            if (!response.success) {
                throw new Error(response.error || '查询通知失败');
            }

            const data = JSON.parse(response.data);
            const notices = [];

            if (data && data.items) {
                for (const item of data.items) {
                    notices.push({
                        id: item.id || '',
                        title: item.bt || '教务通知',
                        time: item.cjsj || '',
                        content: item.xxnr || '',
                        source: '教务处'
                    });
                }
            }

            return notices;
        } catch (error) {
            console.error('查询通知失败', error);
            return [];
        }
    }

    /**
     * 查询考试
     * @param {string} xnm 学年代码 20xx
     * @param {string} xqm 学期代码 12 | 3
     * @returns {Promise<Array>} 考试列表
     */
    async queryExam(xnm, xqm) {
        try {
            const response = await ipc.easPost(
                this.getFullUrl(UJNAPI.GET_EXAM),
                {
                    xnm: xnm,
                    xqm: xqm,
                    'queryModel.showCount': '999'
                },
                { cookies: await store.getStringSet(this.cookieName) }
            );

            if (!response.success) {
                throw new Error(response.error || '查询考试失败');
            }

            const data = JSON.parse(response.data);
            const exams = [];

            if (data && data.items) {
                for (const item of data.items) {
                    exams.push({
                        name: item.kcmc || '',
                        place: item.cdmc || '',
                        time: item.kssj || '',
                        date: item.kssj ? item.kssj.split(' ')[0] : '',
                        location: item.cdmc || '待定'
                    });
                }
            }

            return exams;
        } catch (error) {
            console.error('查询考试失败', error);
            return [];
        }
    }

    /**
     * 清除Cookie
     */
    clearCookies() {
        this.cookieJar.clearCookies();
    }

    /**
     * 获取账号
     * @returns {Promise<string>} 账号
     */
    async getAccount() {
        return await store.getString(this.accountName, '');
    }

    /**
     * 获取Cookie
     * @returns {Array} Cookie列表
     */
    getCookie() {
        return this.cookieJar.cookiesList;
    }

    /**
     * 登出
     */
    logout() {
        this.clearCookies();
        this.isLogin = false;
    }
}

export default EASAccount;