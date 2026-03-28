declare global {
    type ContentNode = {
        close_date: null,
        id: string,
        is_preview: boolean,
        open_date: null,
        sequence: string,
        text: string,
        time_set: boolean,
        type: "contents",
        url_slug: string,
    };

    type APILearn = {
        index: string;
        type: number;
        subject: string;
        description: string;
        contents: string;
        coverImage: string;
        id: string;
        student_count: number;
        origin_channel_index: string;

        category: {
            first: {
                id: string;
                label: {
                    default: string;
                    ko: string;
                    en: string;
                    ja: string;
                };
            };
            second: {
                id: string;
                label: {
                    default: string;
                    ko: string;
                    en: string;
                    ja: string;
                };
            };
            _id: string;
        };

        lessons: string[];

        week: null;
        estimatedTime: number;
        use_certificate: boolean;

        curriculumData: {
            label: string;
            index: string;
            name: string;

            isUserPermission: boolean;

            allLessons: number;
            completedLessons: number;

            new: boolean;

            lessons: {
                index: string;
                sequence: number;

                urlSlug: string;

                type: 'contents' | 'tutorial' | string;

                name: string;

                useTimeSet?: boolean;

                open_date?: string | null;
                close_date?: string | null;

                isOpen: boolean;

                first_access?: string;
                last_access?: string;
                completedAt?: string;

                isSample: boolean;

                state: number;
                score: number;

                create_time: string;

                new: boolean;

                hasSubmittedSource?: boolean;

                tutorialQuizIndex?: string;

                icon: string;

                hasVideo: boolean;

                isPreview: boolean;
                isLocked: boolean;
                isPrivate: boolean;

                contentsCategory: string | null;

                contentsType: string;
            }[];
        }[];
    };

    type APIWorkspaceLesson = {
        result: {
            removedBookmarks: string[];
            bookmarks: string[];
            quizIndex: string;
            quizOutputFile: {
                use: boolean;
                filepath: string;
            };
            quizSequence: number;
            quizUrlSlug: string;
            quizForm: string; // programming 등
            quizType: string; // programming 등
            quizMode: string; // exam_mode 등
            quizSkeletonType: string; // editor 등
            project: {
                [key: string]: {
                    projectKey: string;

                    language: string;
                    langVersion: string;

                    projectCode: string;

                    label: string;

                    mainFiletype: string;

                    files: {
                        filepath: string;

                        filename: string;

                        label: string;

                        isDir: boolean;

                        isMain: boolean;

                        content: {
                            source: string;

                            readonly: boolean;

                            hidden: boolean;
                        }[];
                    }[];
                };
            };

            quizRunTimeLimit: number;
        };
    };

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

    type LessonInitialState = {
        isIE: boolean;
        locale: string;
        host: string;

        userData: {
            id: string;
            name: string;
            email: string;
            language: string;
            isTeacher: boolean;
            isAdmin: boolean;
            hasLoginId: boolean;
            isDevelupUser: boolean;
        };

        channel: {
            index: string;
            name: string;
            channelType: string;
            useAssessment: boolean;
            hideChat: boolean;
            hideQna: boolean;
            useTTSAudio: boolean;
        };

        isChannel: boolean;
        isChannelGroup: boolean;
        isMobile: boolean;
        isGit: boolean;

        collaborationRoomId: string;
        collaborationRoomName: string;
        isMine: boolean;

        lesson: {
            _id: string;
            badge: {
                name: string;
                src: string;
            };

            completionConditionOptions: {
                resolveQuiz: number;
                watchVideo: boolean;
            };

            files: any[];
            not_opened: any[];

            tutorial_quiz_contents_components: {
                type: string;
                content: string;
                componentKey: string;
            }[];

            repl_lang: string[];
            view_count: number;
            is_preview: boolean;
            collaboration: string;

            contentsCategory: string | null;
            contentsType: string;

            useAISA: boolean;

            contents_components: {
                type: string;
                content: string;
                playerOptions: {
                    captions: any[];
                };
                index_arr: any[];
                inflearnUnitList: any[];
                _id: string;
                componentKey: string;
            }[];

            llmQuizList: any[];

            index: string;
            lecture_index: string;
            lecture_subject: string;
            subject: string;
            instructor: string;

            create_time: string;
            is_open: boolean;
            type: string;
            updated: string;

            tutorial_quiz_index: string;
            quiz_form: string;

            origin_lesson_index: string;
            is_sample: boolean;
            connected_lesson: string;

            url_slug: string;
            sequence: number;

            state: number;

            completedConditions: {
                resolveQuiz: number;
            };

            quiz: {
                answer_language: string[];

                contentsType: string;
                contents: string;

                useRunScreenExample: boolean;
                runScreenExample: string;

                inputExample: string[];
                outputExample: string[];

                isCollaborationQuizForm: boolean;

                options: Record<string, unknown>;

                markOptions: {
                    mark_trim: boolean;
                    mark_line_trim: boolean;
                    mark_all_trim: boolean;
                    mark_delete_comma: boolean;
                    mark_delete_period: boolean;
                    mark_ignore_capital: boolean;
                };
            };
        };

        userAgent: string;
        isIE11: boolean;
        isHelpChannel: boolean;

        embed: unknown;

        ideHost: string;
        entryHostPath: string;
        microbitHostPath: string;
        codingpartyEntryHostPath: string;
        serviceNotice: unknown;

        accountHost: string;

        thirdPartySettings: {
            swcamp: { active: boolean };
            exp: { active: boolean };
            aiGoormee: {
                active: boolean;
                lectureSettingActive: boolean;
            };
            mOTP: Record<string, unknown>;
        };

        isStudent: boolean;
        isTeacher: boolean;

        lecture: {
            index: string;
            type: number;
            subject: string;
            description: string;
            contents: string;
            coverImage: string;
            id: string;
            student_count: number;
            origin_channel_index: string;

            category: {
                first: {
                    id: string;
                    label: {
                        default: string;
                        ko: string;
                        en: string;
                        ja: string;
                    };
                };
                second: {
                    id: string;
                    label: {
                        default: string;
                        ko: string;
                        en: string;
                        ja: string;
                    };
                };
                _id: string;
            };

            lessons: string[];

            week: unknown;
            estimatedTime: number;
            use_certificate: boolean;

            curriculum: any[]; // 👉 이거 너무 커서 any 추천
        };
    };

    type LectureInitialState = {
        isIE: boolean;
        locale: string;
        contactType: string;
        contactAppId: string;

        userData: InitialState["userData"];

        isChannel: boolean;
        isChannelGroup: boolean;
        isMobile: boolean;
        isGit: boolean;
        isAssessLecture: boolean;

        channelData: InitialState["channelData"];

        hostUrl: string;
        serviceNotice: null;
        currentPath: string;
        accountHost: string;
        isExistNoticeNew: boolean;

        settings: InitialState["settings"];

        useRoute: boolean;
        useB2g: boolean;

        categoryList: InitialState["categoryList"][];

        lectureData: {
            index: string;
            name: string;
            description: string | null;
            thumbnail: string | null;
            isPublic: boolean;
            isFree: boolean;
            isCompleted: boolean;
            progress: number;

            curriculumData: APILearn["curriculumData"];
        };
    }
}

export { };