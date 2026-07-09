import { baseApi } from "../../services/baseApi";

export const authApi =
  baseApi.injectEndpoints({
    endpoints: (builder) => ({
      login: builder.mutation({
        query: (body) => ({
          url: "/auth/login",
          method: "POST",
          body,
        }),
      }),

      me: builder.query({
        query: () => "/auth/me",
      }),

      logout: builder.mutation({
        query: () => ({
          url: "/auth/logout",
          method: "POST",
        }),
      }),
    }),
  });

export const {
  useLoginMutation,
  useMeQuery,
  useLogoutMutation,
} = authApi;