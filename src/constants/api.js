// src/constants/api.js

/**
 * 济南大学API常量
 */
export const UJNAPI = {
    /**
     * 智慧济大VPN HOST
     */
    VPN_HOST: 'webvpn.ujn.edu.cn',

    /**
     * 智慧济大VPN登录入口
     */
    VPN_LOGIN: 'https://webvpn.ujn.edu.cn/',

    /**
     * 智慧济大 HOST
     */
    IPASS_HOST: 'sso.ujn.edu.cn',

    /**
     * 智慧济大登录入口
     */
    IPASS_LOGIN: 'http://sso.ujn.edu.cn/tpass/login/',

    /**
     * 教务系统HOST
     */
    EA_HOSTS: [
        'jwgl.ujn.edu.cn',
        'jwgl2.ujn.edu.cn',
        'jwgl3.ujn.edu.cn',
        'jwgl4.ujn.edu.cn',
        'jwgl5.ujn.edu.cn',
        'jwgl6.ujn.edu.cn',
        'jwgl7.ujn.edu.cn',
        'jwgl8.ujn.edu.cn',
        'jwgl9.ujn.edu.cn'
    ],

    /**
     * 教务登录
     */
    EA_LOGIN: 'jwglxt/xtgl/login_slogin.html',

    /**
     * 教务登录，获取RSA公钥
     */
    EA_LOGIN_PUBLIC_KEY: 'jwglxt/xtgl/login_getPublicKey.html',

    /**
     * 教务系统消息查询
     */
    EA_SYSTEM_NOTICE: 'jwglxt/xtgl/index_cxDbsy.html?doType=query',

    /**
     * 学年信息
     */
    EA_YEAR_DATA: 'jwglxt/xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index',

    /**
     * 查询学生课表
     */
    GET_LESSON_TABLE: 'jwglxt/kbcx/xskbcx_cxXsgrkb.html',

    /**
     * 查询班级课表
     */
    GET_CLASS_LESSON_TABLE: 'jwglxt/kbdy/bjkbdy_cxBjKb.html',

    /**
     * 推荐课表打印页面
     */
    RECOMMENDED_LESSON_TABLE_PRINTING: 'jwglxt/kbdy/bjkbdy_cxBjkbdyIndex.html?gnmkdm=0&layout=default',

    /**
     * 成绩查询
     */
    GET_MARK: 'jwglxt/cjcx/cjcx_cxDgXscj.html?doType=query',

    /**
     * 成绩明细查询
     */
    GET_MARK_DETAIL: 'jwglxt/cjcx/cjcx_cxXsKccjList.html',

    /**
     * 考试查询
     */
    GET_EXAM: 'jwglxt/kwgl/kscx_cxXsksxxIndex.html?doType=query',

    /**
     * 学业情况查询界面
     */
    ACADEMIC_PAGE: 'jwglxt/xsxy/xsxyqk_cxXsxyqkIndex.html?gnmkdm=N105515&layout=default',

    /**
     * 学业情况查询 - 课程信息
     */
    ACADEMIC_INFO: 'jwglxt/xsxy/xsxyqk_cxJxzxjhxfyqFKcxx.html'
};

export default UJNAPI;