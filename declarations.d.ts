declare global {
    type InitialState = {
        isIE: boolean;
        locale: string;
        contactType: string;
        contactAppId: string;
        bootpayAppId: string;

        publicLectureList: Record<string, unknown>;
        promotionLectureList: Record<string, unknown>;

        channelLectureList: {
            allLectures: {
                _id: string;
                index: string;
                type: number;

                subject: string;
                description: string;

                cover_image?: string;
                coverImage: string;

                id: string;
                student_count: number;

                origin_channel_index: string;

                category: {
                    first: { id: string };
                    second: { id: string };
                    _id: string;
                };

                use_certificate: boolean;
                difficulty: number;

                classification: string[];

                review: {
                    total_score: number;
                    participants_count: number;
                    grade: number;
                    active: boolean;
                };

                recommend: {
                    text: string;
                    _id: string;
                }[];

                userDivisionIndex: unknown[];

                first_started_time: string;
                url_slug: string;

                sequence: number;

                owner: {
                    id: string;
                    name: string;
                    email: string;
                };

                myLecture: boolean;
            }[];
        };

        userData: {
            id: string;
            name: string;
            email: string;

            language: string;

            isTeacher: boolean;
            isAdmin: boolean;

            hashedId: string;

            signupDate: string;

            hasLoginId: boolean;
            isDevelupUser: boolean;

            userDivisionIndex: unknown[];
            belongData: Record<string, unknown>;
        };

        channelData: {
            index: string;
            name: string;

            colorLogo: string;

            channelType: string;

            useCustomMain: boolean;

            isInvited: boolean;
            isAdmin: boolean;
            isTeacher: boolean;

            useLecture: boolean;
            useAssessment: boolean;

            hideQna: boolean;
            hideContactWidget: boolean;

            hideStudentSignUp: boolean;
            hideTeacherSignUp: boolean;

            hideJoinNotice: boolean;
            hideCoverPhrase: boolean;

            disableLectureApply: boolean;

            usePublicChannelLectureCardStyle: boolean;
            useUserDivision: boolean;

            hideMainBanner: boolean;
        };

        isChannel: boolean;
        isChannelGroup: boolean;
        isHelpChannel: boolean;
        isSchoolChannel: boolean;

        hostUrl: string;
        path: string;

        isMobile: boolean;
        isGit: boolean;

        serviceNotice: unknown;

        isLectureIntroTarget: boolean;
        timerBar: boolean;
        isExistNoticeNew: boolean;

        settings: {
            swcamp: { active: boolean };
            exp: { active: boolean };
            exelearnce: Record<string, unknown>;
        };

        useRoute: boolean;
        gemHost: string;

        categoryList: {
            _id: string;
            index: string;

            channelIndex: string;

            hierarchy: number;

            label: {
                default: string;
                ko: string;
                en: string;
                ja: string;
            };

            order: number;

            value: string;
        }[];

        lectureCategories: Record<string, number>;

        showsEmptyCategory: boolean;

        channelNoticeList: unknown[];
        curations: unknown[];
    };
}

export { };