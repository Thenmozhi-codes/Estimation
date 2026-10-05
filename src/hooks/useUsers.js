import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userRepo } from "@/lib/api/repos";
import { createUser, updateUser, removeUser } from "@/lib/services/userService";
import { createRole, updateRole, deleteRole } from "@/lib/services/roleService";
import { getAllRoles } from "@/lib/domain/roles";
import { useRolesVersion } from "@/lib/store/rolesStore";

/* ─────────────── Users ─────────────── */

export const useUsers = () =>
  useQuery({
    queryKey: ["users"],
    queryFn: () => userRepo.list(),
  });

export const useSaveUser = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }) =>
      id ? updateUser(id, values) : createUser(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id) => removeUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

/* ─────────────── Roles ─────────────── */

/* Read straight from the store, so a change shows up instantly */
export const useRoles = () => {
  const version = useRolesVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getAllRoles(), [version]);
};

export const useSaveRole = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }) =>
      id ? updateRole(id, values) : createRole(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useDeleteRole = () =>
  useMutation({ mutationFn: (id) => deleteRole(id) });
