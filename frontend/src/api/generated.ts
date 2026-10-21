export interface paths {
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register
         * @description Регистрация: создаёт пользователя (status=pending) и отправляет
         *     6-значный код подтверждения на почту.
         */
        post: operations["register_api_v1_auth_register_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/verify-email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify Email
         * @description Подтверждение почты кодом из письма: pending → verified.
         */
        post: operations["verify_email_api_v1_auth_verify_email_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/verify-email/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resend Verification
         * @description Новый код подтверждения почты (старые коды аннулируются).
         */
        post: operations["resend_verification_api_v1_auth_verify_email_resend_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password-recovery/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Password Recovery Request
         * @description Запрос восстановления пароля: отправляет код на почту.
         *
         *     Всегда отвечает 204 — не раскрывает, существует ли такой email.
         */
        post: operations["password_recovery_request_api_v1_auth_password_recovery_request_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password-recovery/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Password Recovery Verify
         * @description Проверка кода восстановления (без побочных эффектов).
         */
        post: operations["password_recovery_verify_api_v1_auth_password_recovery_verify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password-recovery/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Password Recovery Reset
         * @description Смена пароля по коду: код одноразовый, все сессии отзываются.
         */
        post: operations["password_recovery_reset_api_v1_auth_password_recovery_reset_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_api_v1_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Refresh */
        post: operations["refresh_api_v1_auth_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout */
        post: operations["logout_api_v1_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Me */
        get: operations["me_api_v1_auth_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Me */
        patch: operations["update_me_api_v1_auth_me_patch"];
        trace?: never;
    };
    "/api/v1/auth/me/proverkacheka-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Proverkacheka Token */
        get: operations["get_proverkacheka_token_api_v1_auth_me_proverkacheka_token_get"];
        /** Update Proverkacheka Token */
        put: operations["update_proverkacheka_token_api_v1_auth_me_proverkacheka_token_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change Password
         * @description Смена пароля: проверка текущего, отзыв всех прочих сессий, ротация кук.
         */
        post: operations["change_password_api_v1_auth_change_password_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Token */
        post: operations["token_api_v1_auth_token_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auto-tagging": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Auto Tagging Status */
        get: operations["get_auto_tagging_status_api_v1_auto_tagging_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Auto Tagging */
        patch: operations["update_auto_tagging_api_v1_auto_tagging_patch"];
        trace?: never;
    };
    "/api/v1/auto-tagging/retrain": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retrain Auto Tagging */
        post: operations["retrain_auto_tagging_api_v1_auto_tagging_retrain_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auto-tagging/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Auto Tagging Metrics */
        get: operations["get_auto_tagging_metrics_api_v1_auto_tagging_metrics_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Users */
        get: operations["list_users_api_v1_admin_users_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get User */
        get: operations["get_user_api_v1_admin_users__user_id__get"];
        put?: never;
        post?: never;
        /** Delete User */
        delete: operations["delete_user_api_v1_admin_users__user_id__delete"];
        options?: never;
        head?: never;
        /** Update User */
        patch: operations["update_user_api_v1_admin_users__user_id__patch"];
        trace?: never;
    };
    "/api/v1/admin/users/{user_id}/limits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update User Limits */
        patch: operations["update_user_limits_api_v1_admin_users__user_id__limits_patch"];
        trace?: never;
    };
    "/api/v1/receipts/parse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Parse Receipt */
        post: operations["parse_receipt_api_v1_receipts_parse_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/receipts/manual": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Manual Receipt */
        post: operations["create_manual_receipt_api_v1_receipts_manual_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/receipts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Receipts */
        get: operations["list_receipts_api_v1_receipts_get"];
        put?: never;
        /** Create Receipt */
        post: operations["create_receipt_api_v1_receipts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/receipts/{receipt_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Receipt */
        get: operations["get_receipt_api_v1_receipts__receipt_id__get"];
        put?: never;
        post?: never;
        /** Delete Receipt */
        delete: operations["delete_receipt_api_v1_receipts__receipt_id__delete"];
        options?: never;
        head?: never;
        /** Update Receipt */
        patch: operations["update_receipt_api_v1_receipts__receipt_id__patch"];
        trace?: never;
    };
    "/api/v1/receipts/{receipt_id}/raw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Receipt Raw
         * @description Сырые данные чека (raw_json из proverkacheka). Пусто для ручных чеков.
         */
        get: operations["get_receipt_raw_api_v1_receipts__receipt_id__raw_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/receipts/{receipt_id}/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Receipt Transaction
         * @description Добавляет транзакцию в существующий чек (нумерация продолжается).
         */
        post: operations["add_receipt_transaction_api_v1_receipts__receipt_id__transactions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sellers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Sellers */
        get: operations["list_sellers_api_v1_sellers_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sellers/{seller_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Seller */
        delete: operations["delete_seller_api_v1_sellers__seller_id__delete"];
        options?: never;
        head?: never;
        /** Update Seller */
        patch: operations["update_seller_api_v1_sellers__seller_id__patch"];
        trace?: never;
    };
    "/api/v1/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Transactions
         * @description Страница транзакций: offset-пагинация (для бесконечного скролла),
         *     все фильтры считаются в БД, баланс строки — оконная функция.
         */
        get: operations["list_transactions_api_v1_transactions_get"];
        put?: never;
        /**
         * Create Transaction
         * @description Ручная транзакция без чека — минимальная единица учёта.
         */
        post: operations["create_transaction_api_v1_transactions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/transactions/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Summary
         * @description Показатели за период (или за всё время, если дат нет) — считает SQL.
         */
        get: operations["get_summary_api_v1_transactions_summary_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/transactions/stores": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Stores
         * @description Все магазины пользователя (свои + из чеков) — для фильтра.
         */
        get: operations["list_stores_api_v1_transactions_stores_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/transactions/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Bulk Update Transactions */
        patch: operations["bulk_update_transactions_api_v1_transactions_bulk_patch"];
        trace?: never;
    };
    "/api/v1/transactions/{transaction_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Transaction */
        delete: operations["delete_transaction_api_v1_transactions__transaction_id__delete"];
        options?: never;
        head?: never;
        /** Update Transaction */
        patch: operations["update_transaction_api_v1_transactions__transaction_id__patch"];
        trace?: never;
    };
    "/api/v1/analytics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Analytics
         * @description Аналитика за период: по дням, магазинам, категориям — считает SQL.
         */
        get: operations["get_analytics_api_v1_analytics_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/price-chart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Price Chart
         * @description График цен товара (подстрока или regex) — считает бэкенд.
         */
        get: operations["get_price_chart_api_v1_analytics_price_chart_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Tags */
        get: operations["list_tags_api_v1_tags_get"];
        put?: never;
        /** Create Tag */
        post: operations["create_tag_api_v1_tags_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tags/page": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Tags Page */
        get: operations["list_tags_page_api_v1_tags_page_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tags/{tag_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Tag */
        delete: operations["delete_tag_api_v1_tags__tag_id__delete"];
        options?: never;
        head?: never;
        /** Update Tag */
        patch: operations["update_tag_api_v1_tags__tag_id__patch"];
        trace?: never;
    };
    "/api/v1/aliases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Aliases
         * @description Страница правил (offset-пагинация) + total — правил может быть много.
         */
        get: operations["list_aliases_api_v1_aliases_get"];
        put?: never;
        /**
         * Create Alias
         * @description Создать правило и сразу применить его к подходящим записям.
         */
        post: operations["create_alias_api_v1_aliases_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/aliases/apply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Apply Aliases
         * @description Применить все правила (или одного скоупа) к существующим записям.
         */
        post: operations["apply_aliases_api_v1_aliases_apply_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/aliases/{alias_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Alias
         * @description Удалить правило. Уже применённые переименования не откатываются.
         */
        delete: operations["delete_alias_api_v1_aliases__alias_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Alias
         * @description Обновить правило и переприменить его к подходящим записям.
         */
        patch: operations["update_alias_api_v1_aliases__alias_id__patch"];
        trace?: never;
    };
    "/api/v1/import-export/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview Import
         * @description Разобрать файл и вернуть строки предпросмотра (без записи в БД).
         */
        post: operations["preview_import_api_v1_import_export_preview_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/import-export/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Run Import
         * @description Импортировать подтверждённые строки: авто-создание тегов, bulk-insert.
         */
        post: operations["run_import_api_v1_import_export_import_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/import-export/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Data
         * @description Выгрузить все транзакции в один лист или с разбивкой по месяцам.
         */
        get: operations["export_data_api_v1_import_export_export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/limits/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get My Limits */
        get: operations["get_my_limits_api_v1_limits_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Feedback */
        get: operations["list_feedback_api_v1_feedback_get"];
        put?: never;
        /** Create Feedback */
        post: operations["create_feedback_api_v1_feedback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List My Feedback */
        get: operations["list_my_feedback_api_v1_feedback_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/{feedback_id}/answer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Answer Feedback */
        post: operations["answer_feedback_api_v1_feedback__feedback_id__answer_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/{feedback_id}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Close Feedback */
        post: operations["close_feedback_api_v1_feedback__feedback_id__close_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Root */
        get: operations["root__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness */
        get: operations["liveness_health_live_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness */
        get: operations["readiness_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** AdminUserUpdate */
        AdminUserUpdate: {
            role?: components["schemas"]["UserRole"] | null;
            status?: components["schemas"]["UserStatus"] | null;
        };
        /**
         * AliasApplyRequest
         * @description POST /api/v1/aliases/apply: применить все правила (или одного scope).
         */
        AliasApplyRequest: {
            /** Scope */
            scope?: ("seller" | "product") | null;
        };
        /**
         * AliasApplyResult
         * @description Сколько записей переименовано при применении правил.
         */
        AliasApplyResult: {
            /**
             * Seller Updated Receipts
             * @default 0
             */
            seller_updated_receipts?: number;
            /**
             * Seller Updated Transactions
             * @default 0
             */
            seller_updated_transactions?: number;
            /**
             * Product Updated
             * @default 0
             */
            product_updated?: number;
        };
        /** AliasCreate */
        AliasCreate: {
            /** Original Name */
            original_name: string;
            /** Alias Name */
            alias_name: string;
            /**
             * Scope
             * @default seller
             * @enum {string}
             */
            scope?: "seller" | "product";
            /**
             * Is Regex
             * @default false
             */
            is_regex?: boolean;
            /**
             * Priority
             * @default 0
             */
            priority?: number;
        };
        /** AliasResponse */
        AliasResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Scope
             * @enum {string}
             */
            scope: "seller" | "product";
            /** Original Name */
            original_name: string;
            /** Alias Name */
            alias_name: string;
            /** Is Regex */
            is_regex: boolean;
            /** Priority */
            priority: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** AliasUpdate */
        AliasUpdate: {
            /** Original Name */
            original_name?: string | null;
            /** Alias Name */
            alias_name?: string | null;
            /** Scope */
            scope?: ("seller" | "product") | null;
            /** Is Regex */
            is_regex?: boolean | null;
            /** Priority */
            priority?: number | null;
        };
        /** AnalyticsByCategory */
        AnalyticsByCategory: {
            /**
             * Tag Id
             * Format: uuid
             */
            tag_id: string;
            /** Tag Name */
            tag_name: string;
            /** Tag Color */
            tag_color: string;
            /** Value */
            value: string;
            /**
             * Count
             * @default 0
             */
            count?: number;
        };
        /** AnalyticsByStore */
        AnalyticsByStore: {
            /** Store */
            store: string;
            /** Value */
            value: string;
        };
        /** AnalyticsDaily */
        AnalyticsDaily: {
            /** Day */
            day: string;
            /** Expenses */
            expenses: string;
            /** Income */
            income: string;
            /**
             * Count
             * @default 0
             */
            count?: number;
            /** Trend */
            trend?: string | null;
        };
        /** AnalyticsIndicators */
        AnalyticsIndicators: {
            top_store?: components["schemas"]["AnalyticsByStore"] | null;
            top_category?: components["schemas"]["AnalyticsByCategory"] | null;
            top_weekday?: components["schemas"]["AnalyticsWeekday"] | null;
            top_income_source?: components["schemas"]["AnalyticsByStore"] | null;
        };
        /** AnalyticsResponse */
        AnalyticsResponse: {
            /** Daily */
            daily?: components["schemas"]["AnalyticsDaily"][];
            /** By Store */
            by_store?: components["schemas"]["AnalyticsByStore"][];
            /** By Store Income */
            by_store_income?: components["schemas"]["AnalyticsByStore"][];
            /** By Category */
            by_category?: components["schemas"]["AnalyticsByCategory"][];
            /** By Weekday */
            by_weekday?: components["schemas"]["AnalyticsWeekday"][];
            indicators?: components["schemas"]["AnalyticsIndicators"];
        };
        /** AnalyticsWeekday */
        AnalyticsWeekday: {
            /** Weekday */
            weekday: number;
            /** Value */
            value: string;
            /** Count */
            count: number;
        };
        /** AutoTaggingSettingsUpdate */
        AutoTaggingSettingsUpdate: {
            /** Enabled */
            enabled: boolean;
        };
        /** AutoTaggingStatusResponse */
        AutoTaggingStatusResponse: {
            /** Enabled */
            enabled: boolean;
            /**
             * Status
             * @enum {string}
             */
            status: "disabled" | "insufficient_data" | "stale" | "training" | "ready" | "degraded" | "error";
            /** Current Revision */
            current_revision: number;
            /** Trained Revision */
            trained_revision?: number | null;
            /** Algorithm Version */
            algorithm_version: string;
            /** Trained At */
            trained_at?: string | null;
            /** Training Examples */
            training_examples: number;
            /** Validation Examples */
            validation_examples: number;
            /** Distinct Tags */
            distinct_tags: number;
            /** Supported Tags */
            supported_tags: number;
            /** Minimum Training Examples */
            minimum_training_examples: number;
            /** Minimum Examples Per Tag */
            minimum_examples_per_tag: number;
            /** Target Precision */
            target_precision: number;
            /** Precision */
            precision?: number | null;
            /** Coverage */
            coverage?: number | null;
            /** Macro F1 */
            macro_f1?: number | null;
            /** Store Baseline Precision */
            store_baseline_precision?: number | null;
            /** Threshold */
            threshold?: number | null;
            /** Per Tag Metrics */
            per_tag_metrics?: components["schemas"]["AutoTaggingTagMetric"][];
        };
        /** AutoTaggingTagMetric */
        AutoTaggingTagMetric: {
            /**
             * Tag Id
             * Format: uuid
             */
            tag_id: string;
            /** Tag Name */
            tag_name: string;
            /** Tag Color */
            tag_color: string;
            /** Tag Icon */
            tag_icon?: string | null;
            /** Training Examples */
            training_examples: number;
            /** Validation Examples */
            validation_examples: number;
            /** Precision */
            precision?: number | null;
            /** Recall */
            recall?: number | null;
            /** Supported */
            supported: boolean;
        };
        /** Body_preview_import_api_v1_import_export_preview_post */
        Body_preview_import_api_v1_import_export_preview_post: {
            /** File */
            file: string;
        };
        /** Body_token_api_v1_auth_token_post */
        Body_token_api_v1_auth_token_post: {
            /** Grant Type */
            grant_type?: string | null;
            /** Username */
            username: string;
            /**
             * Password
             * Format: password
             */
            password: string;
            /**
             * Scope
             * @default
             */
            scope?: string;
            /** Client Id */
            client_id?: string | null;
            /**
             * Client Secret
             * Format: password
             */
            client_secret?: string | null;
        };
        /** CursorPage[AliasResponse] */
        CursorPage_AliasResponse_: {
            /** Items */
            items: components["schemas"]["AliasResponse"][];
            /** Next Cursor */
            next_cursor?: string | null;
            /** Total */
            total?: number | null;
        };
        /** CursorPage[ReceiptResponse] */
        CursorPage_ReceiptResponse_: {
            /** Items */
            items: components["schemas"]["ReceiptResponse"][];
            /** Next Cursor */
            next_cursor?: string | null;
            /** Total */
            total?: number | null;
        };
        /** CursorPage[TagResponse] */
        CursorPage_TagResponse_: {
            /** Items */
            items: components["schemas"]["TagResponse"][];
            /** Next Cursor */
            next_cursor?: string | null;
            /** Total */
            total?: number | null;
        };
        /** CursorPage[TransactionOut] */
        CursorPage_TransactionOut_: {
            /** Items */
            items: components["schemas"]["TransactionOut"][];
            /** Next Cursor */
            next_cursor?: string | null;
            /** Total */
            total?: number | null;
        };
        /** CursorPage[UserAdminResponse] */
        CursorPage_UserAdminResponse_: {
            /** Items */
            items: components["schemas"]["UserAdminResponse"][];
            /** Next Cursor */
            next_cursor?: string | null;
            /** Total */
            total?: number | null;
        };
        /** FeedbackAnswer */
        FeedbackAnswer: {
            /** Reply */
            reply: string;
        };
        /** FeedbackCreate */
        FeedbackCreate: {
            /** Subject */
            subject: string;
            /** Message */
            message: string;
        };
        /** FeedbackPageResponse */
        FeedbackPageResponse: {
            /** Items */
            items: components["schemas"]["FeedbackResponse"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /** FeedbackResponse */
        FeedbackResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * User Id
             * Format: uuid
             */
            user_id: string;
            /** Email */
            email: string;
            /** Subject */
            subject: string;
            /** Message */
            message: string;
            /** Status */
            status: string;
            /** Admin Reply */
            admin_reply: string | null;
            /** Replied At */
            replied_at: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /**
         * ImportPreview
         * @description Результат предпросмотра файла перед импортом.
         *
         *     Имена полей сохранены короткими для совместимости с текущим API и
         *     фронтендом: total/valid/invalid — агрегаты по строкам.
         */
        ImportPreview: {
            /** Rows */
            rows: components["schemas"]["ImportRowPreview"][];
            /** Total */
            total: number;
            /** Valid */
            valid: number;
            /** Invalid */
            invalid: number;
            /**
             * Duplicates
             * @default 0
             */
            duplicates?: number;
        };
        /** ImportRequest */
        ImportRequest: {
            /** Rows */
            rows: components["schemas"]["ImportRowIn"][];
        };
        /** ImportResult */
        ImportResult: {
            /** Imported */
            imported: number;
            /**
             * Skipped
             * @default 0
             */
            skipped?: number;
            /** Tags Created */
            tags_created?: string[];
            /** Errors */
            errors?: string[];
        };
        /** ImportRowIn */
        ImportRowIn: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Category */
            category?: string | null;
            /** Store */
            store?: string | null;
            /**
             * Description
             * @default
             */
            description?: string;
            /**
             * Quantity
             * @default 1
             */
            quantity?: number | string;
            /**
             * Unit
             * @default шт.
             */
            unit?: string;
            /**
             * Price
             * @default 0
             */
            price?: number | string;
            /**
             * Comment
             * @default
             */
            comment?: string;
            /** Tags */
            tags?: string[];
            /**
             * Income
             * @default 0
             */
            income?: number | string;
            /**
             * Expense
             * @default 0
             */
            expense?: number | string;
            /** Operation Kind */
            operation_kind?: ("income" | "expense") | null;
            /**
             * Allow Duplicate
             * @default false
             */
            allow_duplicate?: boolean;
        };
        /**
         * ImportRowPreview
         * @description Нормализованная строка для предпросмотра перед импортом.
         */
        ImportRowPreview: {
            /** Row Number */
            row_number: number;
            /** Date */
            date?: string | null;
            /** Category */
            category?: string | null;
            /** Store */
            store?: string | null;
            /**
             * Description
             * @default
             */
            description?: string;
            /** Quantity */
            quantity?: string | null;
            /**
             * Unit
             * @default шт.
             */
            unit?: string | null;
            /** Price */
            price?: string | null;
            /**
             * Comment
             * @default
             */
            comment?: string | null;
            /** Tags */
            tags?: string[];
            /** Income */
            income?: string | null;
            /** Expense */
            expense?: string | null;
            /** Operation Kind */
            operation_kind?: ("income" | "expense") | null;
            /** Errors */
            errors?: string[];
            /** Duplicate */
            duplicate?: ("file" | "existing") | null;
            /** Duplicate Of */
            duplicate_of?: number | null;
        };
        /** LogoutRequest */
        LogoutRequest: {
            /** Refresh Token */
            refresh_token: string;
        };
        /**
         * PasswordChange
         * @description Тело POST /auth/change-password — смена пароля с проверкой текущего.
         */
        PasswordChange: {
            /** Current Password */
            current_password: string;
            /** New Password */
            new_password: string;
        };
        /**
         * PasswordRecoveryRequest
         * @description Тело POST /auth/password-recovery/request — запрос кода сброса.
         */
        PasswordRecoveryRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
        };
        /**
         * PasswordRecoveryVerify
         * @description Тело POST /auth/password-recovery/verify — проверка кода сброса.
         */
        PasswordRecoveryVerify: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Code */
            code: string;
        };
        /**
         * PasswordReset
         * @description Тело POST /auth/password-recovery/reset — смена пароля по коду.
         */
        PasswordReset: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Code */
            code: string;
            /** New Password */
            new_password: string;
        };
        /** PriceChartResponse */
        PriceChartResponse: {
            /** Points */
            points?: components["schemas"]["PricePoint"][];
            /** Stores */
            stores?: (string | null)[];
            /** Avg Price */
            avg_price: string;
            /** Median Price */
            median_price: string;
            /** Stddev */
            stddev: string;
            /**
             * Count
             * @default 0
             */
            count?: number;
        };
        /** PricePoint */
        PricePoint: {
            /** Day */
            day: string;
            /** Price */
            price: string;
            /** Count */
            count: number;
            /** Store */
            store: string | null;
            /** Names */
            names?: string[];
        };
        /**
         * ProverkachekaTokenStatus
         * @description Признак наличия токена — сам токен в ответе не отдаётся.
         */
        ProverkachekaTokenStatus: {
            /** Has Token */
            has_token: boolean;
        };
        /**
         * ProverkachekaTokenUpdate
         * @description Тело PUT /auth/me/proverkacheka-token.
         */
        ProverkachekaTokenUpdate: {
            /** Token */
            token: string;
        };
        /** ReceiptCreate */
        ReceiptCreate: {
            /** Qr */
            qr?: string | null;
            /** Raw Json */
            raw_json?: {
                [key: string]: unknown;
            } | null;
            /** Cashback */
            cashback?: number | string | null;
            /** Balance After */
            balance_after?: number | string | null;
        };
        /** ReceiptManualCreate */
        ReceiptManualCreate: {
            /** Seller Name */
            seller_name: string;
            /** Total Sum */
            total_sum: number | string;
            /**
             * Check Datetime
             * Format: date-time
             */
            check_datetime?: string;
            /** Receipt Number */
            receipt_number?: string | null;
            /** Seller Inn */
            seller_inn?: string | null;
            /**
             * Operation Type
             * @default 1
             */
            operation_type?: number;
            /** Cashback */
            cashback?: number | string | null;
            /** Balance After */
            balance_after?: number | string | null;
            /** Transactions */
            transactions?: components["schemas"]["TransactionManualIn"][] | null;
        };
        /** ReceiptParseRequest */
        ReceiptParseRequest: {
            /** Qr */
            qr?: string | null;
            /** Raw Json */
            raw_json?: {
                [key: string]: unknown;
            } | null;
        };
        /** ReceiptPreviewOut */
        ReceiptPreviewOut: {
            /** Qr */
            qr: string | null;
            /** Receipt Number */
            receipt_number: string | null;
            /** Operation Type */
            operation_type: number;
            /** Seller Name */
            seller_name: string;
            /** Normalized Seller Name */
            normalized_seller_name?: string | null;
            /** Seller Name Alias Id */
            seller_name_alias_id?: string | null;
            /** Seller Name Alias Name */
            seller_name_alias_name?: string | null;
            /** Seller Inn */
            seller_inn: string | null;
            /**
             * Datetime
             * Format: date-time
             */
            datetime: string;
            /** Total Sum */
            total_sum: string;
            /** Transactions */
            transactions: components["schemas"]["TransactionOut"][];
        };
        /** ReceiptResponse */
        ReceiptResponse: {
            /** Qr */
            qr: string | null;
            /** Receipt Number */
            receipt_number: string | null;
            /** Operation Type */
            operation_type: number;
            /** Seller Name */
            seller_name: string;
            /** Normalized Seller Name */
            normalized_seller_name?: string | null;
            /** Seller Name Alias Id */
            seller_name_alias_id?: string | null;
            /** Seller Name Alias Name */
            seller_name_alias_name?: string | null;
            /** Seller Inn */
            seller_inn: string | null;
            /**
             * Datetime
             * Format: date-time
             */
            datetime: string;
            /** Total Sum */
            total_sum: string;
            /** Transactions */
            transactions: components["schemas"]["TransactionOut"][];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Seller Id */
            seller_id?: string | null;
            /** Cashback */
            cashback?: string | null;
            /** Balance After */
            balance_after?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /**
         * ReceiptUpdate
         * @description Точечное обновление чека: применяются только присланные поля.
         *
         *     qr/raw_json не редактируются (qr — ключ дедупликации).
         */
        ReceiptUpdate: {
            /** Receipt Number */
            receipt_number?: string | null;
            /** Operation Type */
            operation_type?: number | null;
            /** Seller Name */
            seller_name?: string | null;
            /** Seller Inn */
            seller_inn?: string | null;
            /** Check Datetime */
            check_datetime?: string | null;
            /** Total Sum */
            total_sum?: number | string | null;
            /** Cashback */
            cashback?: number | string | null;
            /** Balance After */
            balance_after?: number | string | null;
        };
        /** RefreshRequest */
        RefreshRequest: {
            /** Refresh Token */
            refresh_token: string;
        };
        /**
         * ResendVerificationRequest
         * @description Тело POST /auth/verify-email/resend — новый код подтверждения.
         */
        ResendVerificationRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
        };
        /** SellerDeleteResponse */
        SellerDeleteResponse: {
            /**
             * Deleted
             * @default true
             */
            deleted?: boolean;
            /**
             * Seller Id
             * Format: uuid
             */
            seller_id: string;
            /** Seller Name */
            seller_name: string;
        };
        /** SellerResponse */
        SellerResponse: {
            /**
             * Seller Id
             * Format: uuid
             */
            seller_id: string;
            /** Seller Name */
            seller_name: string;
            /** Normalized Seller Name */
            normalized_seller_name: string;
            /** Alias Id */
            alias_id?: string | null;
            /** Alias Name */
            alias_name?: string | null;
            /** Transaction Count */
            transaction_count: number;
            /** Receipt Count */
            receipt_count: number;
            /** Filter Value */
            filter_value: string;
        };
        /** SellerUpdate */
        SellerUpdate: {
            /** Seller Name */
            seller_name: string;
        };
        /**
         * StoreResponse
         * @description Магазин для фильтра: исходное, normalized и применённый алиас.
         */
        StoreResponse: {
            /**
             * Seller Id
             * Format: uuid
             */
            seller_id: string;
            /** Seller Name */
            seller_name: string;
            /** Normalized Seller Name */
            normalized_seller_name?: string | null;
            /** Alias Id */
            alias_id?: string | null;
            /** Alias Name */
            alias_name?: string | null;
            /** Filter Value */
            filter_value: string;
        };
        /** TagCreate */
        TagCreate: {
            /** Name */
            name: string;
            /** Color */
            color: string;
            /** Icon */
            icon?: string | null;
        };
        /** TagResponse */
        TagResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Color */
            color: string;
            /** Icon */
            icon: string | null;
            /** Count */
            count: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** TagUpdate */
        TagUpdate: {
            /** Name */
            name?: string | null;
            /** Color */
            color?: string | null;
            /** Icon */
            icon?: string | null;
        };
        /** TokenPair */
        TokenPair: {
            /** Access Token */
            access_token: string;
            /** Refresh Token */
            refresh_token: string;
            /**
             * Token Type
             * @default bearer
             */
            token_type?: string;
        };
        /**
         * TransactionBulkUpdate
         * @description Atomic patch applied to an owned set of transactions.
         */
        TransactionBulkUpdate: {
            /** Ids */
            ids: string[];
            patch: components["schemas"]["TransactionUpdate"];
        };
        /** TransactionBulkUpdateResult */
        TransactionBulkUpdateResult: {
            /** Updated */
            updated: number;
        };
        /**
         * TransactionCreate
         * @description Ручная транзакция без чека (POST /api/v1/transactions).
         */
        TransactionCreate: {
            /** Name */
            name: string;
            /** Seller Name */
            seller_name?: string | null;
            /** Amount */
            amount: number | string;
            /** Quantity */
            quantity?: number | string | null;
            /** Unit */
            unit?: string | null;
            /** Price */
            price?: number | string | null;
            /**
             * Operation Type
             * @default 1
             */
            operation_type?: number;
            /**
             * Datetime
             * Format: date-time
             */
            datetime?: string;
            /** Tag Id */
            tag_id?: string | null;
            /** Comment */
            comment?: string | null;
        };
        /**
         * TransactionInReceipt
         * @description Транзакция, добавляемая в существующий чек (POST /receipts/{id}/transactions).
         */
        TransactionInReceipt: {
            /** Name */
            name: string;
            /** Amount */
            amount: number | string;
            /** Quantity */
            quantity?: number | string | null;
            /** Unit */
            unit?: string | null;
            /** Price */
            price?: number | string | null;
            /** Tag Id */
            tag_id?: string | null;
        };
        /**
         * TransactionManualIn
         * @description Позиция ручного чека (POST /receipts/manual):
         *     amount = price * quantity, если не задан.
         */
        TransactionManualIn: {
            /** Name */
            name: string;
            /** Quantity */
            quantity?: number | string | null;
            /** Unit */
            unit?: string | null;
            /** Price */
            price?: number | string | null;
            /** Amount */
            amount?: number | string | null;
        };
        /**
         * TransactionOut
         * @description Транзакция: сохранённая (из БД) или превью (id/tag_id = None).
         *
         *     seller_name: effective API value; standalone transactions use their own
         *     Seller relation, while receipt transactions inherit the receipt seller.
         *     balance: нарастающий итог (оконная функция по всем транзакциям
         *     пользователя); заполняется списком транзакций, в чеках — None.
         */
        TransactionOut: {
            /** Id */
            id?: string | null;
            /** Receipt Id */
            receipt_id?: string | null;
            /** Name */
            name: string;
            /** Normalized Name */
            normalized_name: string;
            /** Name Alias Id */
            name_alias_id?: string | null;
            /** Name Alias Name */
            name_alias_name?: string | null;
            /** Position */
            position?: number | null;
            /** Quantity */
            quantity?: string | null;
            /** Unit */
            unit?: string | null;
            /** Price */
            price?: string | null;
            /** Amount */
            amount: string;
            /**
             * Operation Type
             * @default 1
             */
            operation_type?: number;
            /**
             * Datetime
             * Format: date-time
             */
            datetime: string;
            /** Tag Id */
            tag_id?: string | null;
            /** Tag Source */
            tag_source?: ("manual" | "auto") | null;
            /** Tag Confidence */
            tag_confidence?: number | null;
            /** Seller Id */
            seller_id?: string | null;
            /** Seller Name */
            seller_name?: string | null;
            /** Normalized Seller Name */
            normalized_seller_name?: string | null;
            /** Seller Name Alias Id */
            seller_name_alias_id?: string | null;
            /** Seller Name Alias Name */
            seller_name_alias_name?: string | null;
            /** Comment */
            comment?: string | null;
            /** Balance */
            balance?: string | null;
            /** Created At */
            created_at?: string | null;
        };
        /**
         * TransactionSummary
         * @description Показатели за период (GET /api/v1/transactions/summary).
         *
         *     balance: доходы − расходы за период; opening_balance: нетто ДО периода
         *     (для колонки «Баланс»); *_delta: разница с предыдущим окном той же
         *     длины (None, когда периода нет — «Всё время»).
         */
        TransactionSummary: {
            /** Balance */
            balance: string;
            /** Opening Balance */
            opening_balance: string;
            /** Income */
            income: string;
            /** Expenses */
            expenses: string;
            /** Transactions */
            transactions: number;
            /** Income Delta */
            income_delta?: string | null;
            /** Expenses Delta */
            expenses_delta?: string | null;
            /** Balance Trend */
            balance_trend?: string[];
        };
        /**
         * TransactionUpdate
         * @description Точечное обновление транзакции: применяются только присланные поля.
         *
         *     receipt_id и position не редактируются (перемещение между чеками —
         *     вне скоупа); normalized_name пересчитывается из name.
         */
        TransactionUpdate: {
            /** Name */
            name?: string | null;
            /** Seller Name */
            seller_name?: string | null;
            /** Quantity */
            quantity?: number | string | null;
            /** Unit */
            unit?: string | null;
            /** Price */
            price?: number | string | null;
            /** Amount */
            amount?: number | string | null;
            /** Operation Type */
            operation_type?: number | null;
            /** Datetime */
            datetime?: string | null;
            /** Tag Id */
            tag_id?: string | null;
            /** Comment */
            comment?: string | null;
        };
        /** UserAdminResponse */
        UserAdminResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Email */
            email: string;
            role: components["schemas"]["UserRole"];
            status: components["schemas"]["UserStatus"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            limits: components["schemas"]["UserLimitsResponse"];
        };
        /** UserCreate */
        UserCreate: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Password */
            password: string;
        };
        /** UserLimitsOverview */
        UserLimitsOverview: {
            limits: components["schemas"]["UserLimitsResponse"];
            usage: components["schemas"]["UserUsageResponse"];
        };
        /** UserLimitsResponse */
        UserLimitsResponse: {
            /** Max Tags */
            max_tags: number;
            /** Max Seller Aliases */
            max_seller_aliases: number;
            /** Max Product Aliases */
            max_product_aliases: number;
            /** Max Receipts */
            max_receipts: number;
            /** Max Transactions */
            max_transactions: number;
            /** Max Receipt Items */
            max_receipt_items: number;
            /** Max Import Rows */
            max_import_rows: number;
        };
        /** UserLimitsUpdate */
        UserLimitsUpdate: {
            /** Max Tags */
            max_tags?: number | null;
            /** Max Seller Aliases */
            max_seller_aliases?: number | null;
            /** Max Product Aliases */
            max_product_aliases?: number | null;
            /** Max Receipts */
            max_receipts?: number | null;
            /** Max Transactions */
            max_transactions?: number | null;
            /** Max Receipt Items */
            max_receipt_items?: number | null;
            /** Max Import Rows */
            max_import_rows?: number | null;
        };
        /** UserLogin */
        UserLogin: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Password */
            password: string;
        };
        /** UserResponse */
        UserResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Email */
            email: string;
            role: components["schemas"]["UserRole"];
            status: components["schemas"]["UserStatus"];
        };
        /**
         * UserRole
         * @enum {string}
         */
        UserRole: "user" | "admin";
        /**
         * UserStatus
         * @enum {string}
         */
        UserStatus: "pending" | "verified" | "active" | "blocked";
        /** UserUpdate */
        UserUpdate: {
            /** Email */
            email?: string | null;
            /** Password */
            password?: string | null;
        };
        /** UserUsageResponse */
        UserUsageResponse: {
            /** Tags */
            tags: number;
            /** Seller Aliases */
            seller_aliases: number;
            /** Product Aliases */
            product_aliases: number;
            /** Receipts */
            receipts: number;
            /** Transactions */
            transactions: number;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
        /**
         * VerifyEmailRequest
         * @description Тело POST /auth/verify-email — подтверждение почты 6-значным кодом.
         */
        VerifyEmailRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Code */
            code: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    register_api_v1_auth_register_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    verify_email_api_v1_auth_verify_email_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerifyEmailRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    resend_verification_api_v1_auth_verify_email_resend_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResendVerificationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    password_recovery_request_api_v1_auth_password_recovery_request_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordRecoveryRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    password_recovery_verify_api_v1_auth_password_recovery_verify_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordRecoveryVerify"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    password_recovery_reset_api_v1_auth_password_recovery_reset_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordReset"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    login_api_v1_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserLogin"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    refresh_api_v1_auth_refresh_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["RefreshRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    logout_api_v1_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["LogoutRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    me_api_v1_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
        };
    };
    update_me_api_v1_auth_me_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_proverkacheka_token_api_v1_auth_me_proverkacheka_token_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProverkachekaTokenStatus"];
                };
            };
        };
    };
    update_proverkacheka_token_api_v1_auth_me_proverkacheka_token_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProverkachekaTokenUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProverkachekaTokenStatus"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    change_password_api_v1_auth_change_password_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordChange"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    token_api_v1_auth_token_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": components["schemas"]["Body_token_api_v1_auth_token_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_auto_tagging_status_api_v1_auto_tagging_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoTaggingStatusResponse"];
                };
            };
        };
    };
    update_auto_tagging_api_v1_auto_tagging_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AutoTaggingSettingsUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoTaggingStatusResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    retrain_auto_tagging_api_v1_auto_tagging_retrain_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoTaggingStatusResponse"];
                };
            };
        };
    };
    get_auto_tagging_metrics_api_v1_auto_tagging_metrics_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoTaggingStatusResponse"];
                };
            };
        };
    };
    list_users_api_v1_admin_users_get: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                role?: components["schemas"]["UserRole"] | null;
                status?: components["schemas"]["UserStatus"] | null;
                q?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_UserAdminResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_user_api_v1_admin_users__user_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAdminResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_user_api_v1_admin_users__user_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_user_api_v1_admin_users__user_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AdminUserUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAdminResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_user_limits_api_v1_admin_users__user_id__limits_patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserLimitsUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserLimitsResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    parse_receipt_api_v1_receipts_parse_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReceiptParseRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReceiptPreviewOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_manual_receipt_api_v1_receipts_manual_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReceiptManualCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReceiptResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_receipts_api_v1_receipts_get: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                date_from?: string | null;
                date_to?: string | null;
                seller?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_ReceiptResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_receipt_api_v1_receipts_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReceiptCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReceiptResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_receipt_api_v1_receipts__receipt_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                receipt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReceiptResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_receipt_api_v1_receipts__receipt_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                receipt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_receipt_api_v1_receipts__receipt_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                receipt_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReceiptUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReceiptResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_receipt_raw_api_v1_receipts__receipt_id__raw_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                receipt_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_receipt_transaction_api_v1_receipts__receipt_id__transactions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                receipt_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransactionInReceipt"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransactionOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_sellers_api_v1_sellers_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerResponse"][];
                };
            };
        };
    };
    delete_seller_api_v1_sellers__seller_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                seller_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerDeleteResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_seller_api_v1_sellers__seller_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                seller_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SellerUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_transactions_api_v1_transactions_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
                cursor?: string | null;
                include_total?: boolean;
                date_from?: string | null;
                date_to?: string | null;
                tag_ids?: string[] | null;
                untagged?: boolean;
                search?: string | null;
                seller_names?: string[] | null;
                amount_min?: number | string | null;
                amount_max?: number | string | null;
                operation_kind?: ("income" | "expense") | null;
                sort_by?: "date" | "name" | "store" | "quantity" | "price" | "income" | "expense" | "balance" | "comment";
                sort_dir?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_TransactionOut_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_transaction_api_v1_transactions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransactionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransactionOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_summary_api_v1_transactions_summary_get: {
        parameters: {
            query?: {
                date_from?: string | null;
                date_to?: string | null;
                tag_ids?: string[] | null;
                untagged?: boolean;
                search?: string | null;
                seller_names?: string[] | null;
                amount_min?: number | string | null;
                amount_max?: number | string | null;
                operation_kind?: ("income" | "expense") | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransactionSummary"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_stores_api_v1_transactions_stores_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StoreResponse"][];
                };
            };
        };
    };
    bulk_update_transactions_api_v1_transactions_bulk_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransactionBulkUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransactionBulkUpdateResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_transaction_api_v1_transactions__transaction_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                transaction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_transaction_api_v1_transactions__transaction_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                transaction_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransactionUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransactionOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_analytics_api_v1_analytics_get: {
        parameters: {
            query?: {
                date_from?: string | null;
                date_to?: string | null;
                tag_ids?: string[] | null;
                search?: string | null;
                seller_names?: string[] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyticsResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_price_chart_api_v1_analytics_price_chart_get: {
        parameters: {
            query: {
                name: string;
                is_regex?: boolean;
                date_from?: string | null;
                date_to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceChartResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_tags_api_v1_tags_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagResponse"][];
                };
            };
        };
    };
    create_tag_api_v1_tags_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TagCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_tags_page_api_v1_tags_page_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_TagResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_tag_api_v1_tags__tag_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tag_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_tag_api_v1_tags__tag_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tag_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TagUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_aliases_api_v1_aliases_get: {
        parameters: {
            query?: {
                limit?: number;
                offset?: number;
                scope?: ("seller" | "product") | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_AliasResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_alias_api_v1_aliases_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AliasCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AliasResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    apply_aliases_api_v1_aliases_apply_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AliasApplyRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AliasApplyResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_alias_api_v1_aliases__alias_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alias_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_alias_api_v1_aliases__alias_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alias_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AliasUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AliasResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    preview_import_api_v1_import_export_preview_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_preview_import_api_v1_import_export_preview_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportPreview"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    run_import_api_v1_import_export_import_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_data_api_v1_import_export_export_get: {
        parameters: {
            query?: {
                layout?: "monthly" | "single";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_my_limits_api_v1_limits_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserLimitsOverview"];
                };
            };
        };
    };
    list_feedback_api_v1_feedback_get: {
        parameters: {
            query?: {
                status?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackPageResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_feedback_api_v1_feedback_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_my_feedback_api_v1_feedback_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackResponse"][];
                };
            };
        };
    };
    answer_feedback_api_v1_feedback__feedback_id__answer_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                feedback_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackAnswer"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    close_feedback_api_v1_feedback__feedback_id__close_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                feedback_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    root__get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    liveness_health_live_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    readiness_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
}
